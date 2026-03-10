import os
import uuid
import re
from pathlib import Path

from fastapi import FastAPI, APIRouter, Depends, File, HTTPException, status, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import JWTError, jwt
import requests
from bs4 import BeautifulSoup

import models, auth, database, scraper

# -----------------------------
# ----- Uploads Directory -----
# -----------------------------
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_RESUME_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt"}

# -----------------------------
# ----- FastAPI App & CORS ----
# -----------------------------
app = FastAPI(title="Job Scraper API")

# Temporary fix for CORS to allow Netlify frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later restrict to Netlify URL if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# ----- Database Setup -------
# -----------------------------
models.Base.metadata.create_all(bind=database.engine)

# -----------------------------
# ----- Router & Schemas -----
# -----------------------------
api = APIRouter(prefix="/api")

class SignupBody(BaseModel):
    email: str
    password: str
    full_name: str

class LoginBody(BaseModel):
    email: str
    password: str

class ApplyBody(BaseModel):
    job_title: str
    company: str
    platform: str
    job_link: str
    job_description: str | None = None

class UpdateStatusBody(BaseModel):
    status: str

class UpdateProfileBody(BaseModel):
    full_name: str | None = None
    profile_image: str | None = None
    bio: str | None = None
    skills: str | None = None

class ProfileResponse(BaseModel):
    id: int
    email: str
    full_name: str | None
    profile_image: str | None
    bio: str | None = None
    skills: str | None = None
    resume: str | None = None

    class Config:
        from_attributes = True

# -----------------------------
# ----- Auth Dependency -------
# -----------------------------
async def get_current_user(
    token: str = Depends(auth.oauth2_scheme),
    db: Session = Depends(database.get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Debug: Print token info (remove in production)
    print(f"DEBUG: Received token: {token[:50] if token else 'None'}...")
    
    if not token:
        print("DEBUG: No token provided")
        raise credentials_exception
        
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        
        # Debug: Print email
        print(f"DEBUG: Token email: {email}")
        
        if email is None:
            print("DEBUG: No email in token")
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        print("DEBUG: Token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        print(f"DEBUG: JWT Error: {str(e)}")
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == email).first()
    
    # Debug: Print user found
    print(f"DEBUG: User found: {user is not None}, email: {email}")
    
    if user is None:
        print("DEBUG: User not in database")
        raise credentials_exception
    return user

# -----------------------------
# ----- Root Endpoint ---------
# -----------------------------
@app.get("/")
def root():
    return {"message": "Job Scraper API", "docs": "/docs"}

# -----------------------------
# ----- Auth Routes ----------
# -----------------------------
@api.post("/signup")
def signup(body: SignupBody, db: Session = Depends(database.get_db)):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_pwd = auth.get_password_hash(body.password)
    new_user = models.User(email=body.email, hashed_password=hashed_pwd, full_name=body.full_name)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}

@api.post("/login")
def login(body: LoginBody, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not auth.verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# -----------------------------
# ----- Job Scraper ----------
# -----------------------------
@api.get("/scrape-jobs")
def scrape_jobs(keyword: str, location: str, current_user: models.User = Depends(get_current_user)):
    results = scraper.run_all_scrapers(keyword, location)
    return {"results": results}

@api.post("/apply")
def apply_to_job(body: ApplyBody, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(get_current_user)):
    new_app = models.ApplicationHistory(
        user_id=current_user.id,
        job_title=body.job_title,
        company=body.company,
        platform=body.platform,
        job_link=body.job_link,
        status="Applied"
    )
    db.add(new_app)
    db.commit()
    return {"message": "Application tracked successfully"}

@api.get("/applications/history")
def get_history(db: Session = Depends(database.get_db),
                current_user: models.User = Depends(get_current_user)):
    return db.query(models.ApplicationHistory).filter(models.ApplicationHistory.user_id == current_user.id).all()

@api.put("/applications/{application_id}/status")
def update_application_status(application_id: int, body: UpdateStatusBody,
                              db: Session = Depends(database.get_db),
                              current_user: models.User = Depends(get_current_user)):
    valid_statuses = ["Applied", "Screening", "Interview", "Offer", "Rejected", "Ghosted"]
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    application = db.query(models.ApplicationHistory).filter(
        models.ApplicationHistory.id == application_id,
        models.ApplicationHistory.user_id == current_user.id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    application.status = body.status
    db.commit()
    return {"message": "Status updated successfully", "status": body.status}

# -----------------------------
# ----- Profile Routes -------
# -----------------------------
@api.get("/profile", response_model=ProfileResponse)
def get_profile(current_user: models.User = Depends(get_current_user)):
    return current_user

@api.put("/profile/update")
def update_profile(body: UpdateProfileBody, db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(get_current_user)):
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.profile_image is not None:
        current_user.profile_image = body.profile_image
    if body.bio is not None:
        current_user.bio = body.bio
    if body.skills is not None:
        current_user.skills = body.skills
    db.commit()
    return {"message": "Profile updated"}

# -----------------------------
# ----- Upload Routes --------
# -----------------------------
@app.post("/profile/image")
def upload_profile_image(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Allowed: jpg, jpeg, png, gif, webp")
    name = f"user_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    path = UPLOAD_DIR / name
    path.write_bytes(file.file.read())
    rel = f"uploads/{name}"
    current_user.profile_image = rel
    db.commit()
    return {"profile_image": rel, "message": "Image uploaded"}

@app.post("/profile/resume")
def upload_resume(file: UploadFile = File(...), db: Session = Depends(database.get_db),
                  current_user: models.User = Depends(get_current_user)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_RESUME_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Allowed: pdf, doc, docx, txt")
    name = f"resume_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    path = UPLOAD_DIR / name
    path.write_bytes(file.file.read())
    rel = f"uploads/{name}"
    current_user.resume = rel
    db.commit()
    return {"resume": rel, "message": "Resume uploaded"}


@app.delete("/profile/image")
def delete_profile_image(db: Session = Depends(database.get_db),
                         current_user: models.User = Depends(get_current_user)):
    """Delete profile image"""
    if current_user.profile_image:
        # Try to delete the file
        try:
            img_path = UPLOAD_DIR / current_user.profile_image.replace("uploads/", "")
            if img_path.exists():
                img_path.unlink()
        except Exception:
            pass  # Ignore file deletion errors
        current_user.profile_image = None
        db.commit()
    return {"message": "Profile image removed"}


@app.delete("/profile/resume")
def delete_profile_resume(db: Session = Depends(database.get_db),
                          current_user: models.User = Depends(get_current_user)):
    """Delete profile resume"""
    if current_user.resume:
        # Try to delete the file
        try:
            resume_path = UPLOAD_DIR / current_user.resume.replace("uploads/", "")
            if resume_path.exists():
                resume_path.unlink()
        except Exception:
            pass  # Ignore file deletion errors
        current_user.resume = None
        db.commit()
    return {"message": "Resume removed"}


# -----------------------------
# ----- AI Endpoints ---------
# -----------------------------
@api.get("/ai/health")
def ai_health():
    return {"enabled": True, "provider": "openai" if os.environ.get("OPENAI_API_KEY") else "heuristic"}


class FetchJobBody(BaseModel):
    url: str


@api.post("/ai/fetch-job")
def fetch_job_from_url(body: FetchJobBody, current_user: models.User = Depends(get_current_user)):
    """Fetch job description from a job posting URL"""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(body.url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch job page")
        
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Try to extract job description - common patterns
        text_content = ""
        
        # LinkedIn
        linkedin_desc = soup.find("div", class_="description__text")
        if linkedin_desc:
            text_content = linkedin_desc.get_text(separator="\n", strip=True)
        
        # Naukri
        if not text_content:
            naukri_desc = soup.find("div", class_="job-desc")
            if naukri_desc:
                text_content = naukri_desc.get_text(separator="\n", strip=True)
        
        # Generic fallback - get main content
        if not text_content:
            # Remove scripts and styles
            for script in soup(["script", "style"]):
                script.decompose()
            text_content = soup.get_text(separator="\n", strip=True)
            # Clean up whitespace
            lines = [line.strip() for line in text_content.split("\n") if line.strip()]
            text_content = "\n".join(lines[:100])  # Limit to first 100 lines
        
        if not text_content:
            raise HTTPException(status_code=400, detail="Could not extract job description from URL")
        
        return {"text": text_content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching job: {str(e)}")


class AnalyzeBody(BaseModel):
    job_text: str
    resume_text: str = ""
    skills: str = ""


@api.post("/ai/analyze")
def analyze_job_match(body: AnalyzeBody, current_user: models.User = Depends(get_current_user)):
    """Analyze job match based on resume and skills"""
    job_text_lower = body.job_text.lower()
    resume_text_lower = body.resume_text.lower()
    skills_list = [s.strip().lower() for s in body.skills.split(",") if s.strip()]
    
    # Extract keywords from job
    common_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", 
                   "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
                   "been", "being", "have", "has", "had", "do", "does", "did", "will",
                   "would", "could", "should", "may", "might", "must", "shall", "can",
                   "job", "work", "description", "experience", "year", "years", "company"}
    
    job_words = set(word.strip(".,!?()[]{}") for word in job_text_lower.split() 
                   if len(word) > 2 and word not in common_words)
    
    # Key skills to look for
    tech_skills = ["python", "java", "javascript", "typescript", "react", "angular", "vue",
                  "node", "nodejs", "django", "flask", "fastapi", "spring", "express",
                  "sql", "mysql", "postgresql", "mongodb", "redis", "docker", "kubernetes",
                  "aws", "azure", "gcp", "git", "github", "rest", "api", "graphql",
                  "html", "css", "sass", "less", "bootstrap", "tailwind", "jquery",
                  "c++", "c#", "go", "golang", "rust", "ruby", "php", "swift", "kotlin",
                  "machine learning", "ml", "ai", "deep learning", "data science",
                  "pandas", "numpy", "tensorflow", "pytorch", "scikit", "sklearn",
                  "linux", "unix", "windows", "networking", "security", "cloud",
                  "agile", "scrum", "jira", "ci/cd", "devops", "sre"]
    
    found_skills = []
    for skill in tech_skills:
        if skill in job_text_lower or skill in resume_text_lower or skill in " ".join(skills_list):
            found_skills.append(skill.title() if len(skill) > 3 else skill.upper())
    
    # Calculate match score
    total_skills = len(set(s for s in tech_skills if s in job_text_lower))
    matched_skills = len([s for s in tech_skills if s in job_text_lower and (s in resume_text_lower or s in " ".join(skills_list))])
    
    match_score = int((matched_skills / max(total_skills, 1)) * 100) if total_skills > 0 else 50
    
    # Generate missing keywords
    missing_keywords = [s.title() for s in tech_skills if s in job_text_lower and s not in resume_text_lower and s not in " ".join(skills_list)][:5]
    
    # Generate summary
    summary = f"You match {matched_skills} out of {total_skills} key skills found in this job posting. "
    if match_score >= 70:
        summary += "You appear to be a strong candidate for this role!"
    elif match_score >= 40:
        summary += "You have moderate qualifications. Consider highlighting your relevant skills."
    else:
        summary += "You may want to learn more about the required skills before applying."
    
    return {
        "summary": summary,
        "key_skills": found_skills[:10],
        "match_score": match_score,
        "missing_keywords": missing_keywords
    }


class InterviewQuestionsBody(BaseModel):
    job_text: str
    resume_text: str = ""


@api.post("/ai/interview-questions")
def generate_interview_questions(body: InterviewQuestionsBody, current_user: models.User = Depends(get_current_user)):
    """Generate interview questions based on job and resume"""
    job_text_lower = body.job_text.lower()
    
    # Detect job type and generate relevant questions
    questions = []
    tips = [
        "Research the company before your interview",
        "Practice answering questions out loud",
        "Prepare examples of past achievements",
        "Have questions ready for the interviewer",
        "Dress professionally even for virtual interviews"
    ]
    
    # Technical questions based on keywords
    if any(s in job_text_lower for s in ["python", "java", "javascript", "programming"]):
        questions.extend([
            {"question": "Describe your experience with [programming language]. What projects have you built?", "category": "Technical", "difficulty": "Medium"},
            {"question": "How do you debug code when you encounter an issue?", "category": "Technical", "difficulty": "Medium"},
        ])
    
    if any(s in job_text_lower for s in ["react", "angular", "vue", "frontend", "ui"]):
        questions.append({"question": "Explain the difference between React components and hooks. When would you use each?", "category": "Technical", "difficulty": "Medium"})
    
    if any(s in job_text_lower for s in ["database", "sql", "mysql", "postgresql"]):
        questions.append({"question": "Describe the differences between SQL and NoSQL databases. When would you choose one over the other?", "category": "Technical", "difficulty": "Medium"})
    
    if any(s in job_text_lower for s in ["machine learning", "ml", "ai", "deep learning"]):
        questions.append({"question": "Explain the difference between supervised and unsupervised learning.", "category": "Technical", "difficulty": "Hard"})
    
    # Always add some behavioral questions
    questions.extend([
        {"question": "Tell me about yourself and why you're interested in this role.", "category": "Behavioral", "difficulty": "Easy"},
        {"question": "Describe a challenging project you worked on and how you overcame the obstacles.", "category": "Behavioral", "difficulty": "Medium"},
        {"question": "What are your strengths and weaknesses?", "category": "Behavioral", "difficulty": "Easy"},
        {"question": "Where do you see yourself in 5 years?", "category": "Behavioral", "difficulty": "Easy"},
        {"question": "Why should we hire you?", "category": "Behavioral", "difficulty": "Medium"},
    ])
    
    return {"questions": questions[:10], "tips": tips}


class ResumeOptimizeBody(BaseModel):
    job_text: str
    resume_text: str


@api.post("/ai/resume-optimize")
def optimize_resume(body: ResumeOptimizeBody, current_user: models.User = Depends(get_current_user)):
    """Optimize resume for a job posting"""
    job_text_lower = body.job_text.lower()
    
    # Extract key requirements from job
    suggestions = []
    score = 50
    
    if not body.resume_text or len(body.resume_text) < 50:
        suggestions.append({
            "section": "Content",
            "suggestion": "Your resume appears to be empty or too short. Add your work experience, education, and skills.",
            "priority": "high"
        })
    else:
        # Check for action verbs
        action_verbs = ["led", "managed", "developed", "created", "implemented", "designed", "built", "achieved", "improved"]
        has_action_verbs = any(verb in body.resume_text.lower() for verb in action_verbs)
        
        if not has_action_verbs:
            suggestions.append({
                "section": "Achievements",
                "suggestion": "Use action verbs to describe your accomplishments (e.g., 'Led a team of 5 developers')",
                "priority": "medium"
            })
        else:
            score += 15
        
        # Check for quantifiable metrics
        if any(char.isdigit() for char in body.resume_text):
            score += 10
        else:
            suggestions.append({
                "section": "Quantification",
                "suggestion": "Add numbers to your achievements (e.g., 'Increased sales by 25%')",
                "priority": "medium"
            })
    
    # Check for key skills
    tech_skills = ["python", "java", "javascript", "react", "node", "sql", "aws", "docker"]
    found_skills = [s for s in tech_skills if s in job_text_lower]
    resume_skills = [s for s in tech_skills if s in body.resume_text.lower()]
    
    missing_skills = [s for s in found_skills if s not in resume_skills]
    
    if missing_skills:
        suggestions.append({
            "section": "Skills",
            "suggestion": f"Consider adding these skills mentioned in the job: {', '.join(missing_skills)}",
            "priority": "high"
        })
    else:
        score += 20
    
    # Check for keywords
    keywords = ["experience", "responsibilities", "requirements", "qualifications"]
    found_keywords = [k for k in keywords if k in job_text_lower]
    
    if found_keywords:
        score += 5
    
    # Generate improved summary
    improved_summary = "Results-driven professional with demonstrated skills. "
    if missing_skills:
        improved_summary += f"Experienced in {', '.join(missing_skills[:3])}. "
    improved_summary += "Proven track record of delivering projects on time and meeting business objectives."
    
    return {
        "overall_score": min(score, 100),
        "suggestions": suggestions[:5],
        "improved_summary": improved_summary
    }


class LearningRecommendationsBody(BaseModel):
    skills: str = ""
    job_text: str = ""


@api.post("/ai/learning-recommendations")
def get_learning_recommendations(body: LearningRecommendationsBody, current_user: models.User = Depends(get_current_user)):
    """Get learning resources for skill improvement"""
    job_text_lower = body.job_text.lower()
    skills_lower = body.skills.lower()
    
    # Identify priority skills to learn
    priority_skills = []
    
    skill_resources = {
        "python": {"title": "Python for Everybody", "provider": "Coursera", "url": "https://www.coursera.org/specializations/python", "format": "course", "is_free": False},
        "javascript": {"title": "JavaScript Fundamentals", "provider": "freeCodeCamp", "url": "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/", "format": "course", "is_free": True},
        "react": {"title": "React - The Complete Guide", "provider": "Udemy", "url": "https://www.udemy.com/course/react-the-complete-guide-incl-redux/", "format": "course", "is_free": False},
        "node": {"title": "Node.js Developer Course", "provider": "Udemy", "url": "https://www.udemy.com/course/the-complete-nodejs-developer-course-2/", "format": "course", "is_free": False},
        "sql": {"title": "SQL for Data Science", "provider": "Coursera", "url": "https://www.coursera.org/learn/sql-for-data-science", "format": "course", "is_free": False},
        "aws": {"title": "AWS Solutions Architect", "provider": "AWS Training", "url": "https://aws.amazon.com/training/", "format": "course", "is_free": False},
        "docker": {"title": "Docker for Beginners", "provider": "freeCodeCamp", "url": "https://www.youtube.com/watch?v=fqMOX6JJhGo", "format": "video", "is_free": True},
        "machine learning": {"title": "Machine Learning by Stanford", "provider": "Coursera", "url": "https://www.coursera.org/learn/machine-learning", "format": "course", "is_free": False},
        "data science": {"title": "Data Science Professional Certificate", "provider": "IBM", "url": "https://www.coursera.org/professional-certificates/ibm-data-science", "format": "certificate", "is_free": False},
    }
    
    recommendations = []
    all_mentioned_skills = set()
    
    # Check job text for skills
    for skill in skill_resources.keys():
        if skill in job_text_lower:
            all_mentioned_skills.add(skill)
            priority_skills.append(skill.title())
            if skill in skill_resources:
                recommendations.append(skill_resources[skill])
    
    # Check user's skills
    for skill in skill_resources.keys():
        if skill in skills_lower and skill not in all_mentioned_skills:
            if skill in skill_resources:
                recommendations.append(skill_resources[skill])
    
    # If no specific skills found, add general recommendations
    if not recommendations:
        recommendations = [
            skill_resources["python"],
            skill_resources["javascript"],
            skill_resources["sql"]
        ]
        priority_skills = ["Python", "JavaScript", "SQL"]
    
    return {
        "recommendations": recommendations[:5],
        "priority_skills": list(set(priority_skills))[:5]
    }

# -----------------------------
# ----- Static Files ---------
# -----------------------------
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# -----------------------------
# ----- Include Router -------
# -----------------------------
app.include_router(api)