import os
import uuid
from pathlib import Path
import re

from fastapi import FastAPI, APIRouter, Depends, File, HTTPException, status, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models, auth, database, scraper
from jose import JWTError, jwt
import requests
from bs4 import BeautifulSoup

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

# -----------------------------
# ----- Request Body Schemas ---
# -----------------------------
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
# ----- AI Tools (bonus) ------
# -----------------------------
class FetchJobBody(BaseModel):
    url: str

class AnalyzeBody(BaseModel):
    job_text: str
    resume_text: str | None = None
    skills: str | None = None  # comma or newline separated

class AnalyzeResponse(BaseModel):
    summary: str
    key_skills: list[str]
    match_score: int  # 0..100
    missing_keywords: list[str]

# -----------------------------
# ----- Interview Questions ----
# -----------------------------
class InterviewQuestionsBody(BaseModel):
    job_text: str
    resume_text: str | None = None

class InterviewQuestionItem(BaseModel):
    question: str
    category: str
    difficulty: str

class InterviewQuestionsResponse(BaseModel):
    questions: list[InterviewQuestionItem]
    tips: list[str]

# -----------------------------
# ----- Resume Optimizer -------
# -----------------------------
class ResumeOptimizeBody(BaseModel):
    job_text: str
    resume_text: str

class ResumeSuggestion(BaseModel):
    section: str
    suggestion: str
    priority: str  # high, medium, low

class ResumeOptimizeResponse(BaseModel):
    overall_score: int
    suggestions: list[ResumeSuggestion]
    improved_summary: str

# -----------------------------
# ----- Learning Recommendations
# -----------------------------
class LearningRecommendationsBody(BaseModel):
    skills: str  # comma or newline separated
    job_text: str | None = None

class LearningResource(BaseModel):
    title: str
    provider: str
    url: str
    format: str  # video, course, article, book
    is_free: bool

class LearningRecommendationsResponse(BaseModel):
    recommendations: list[LearningResource]
    priority_skills: list[str]

# -----------------------------
# ----- FastAPI App & CORS ----
# -----------------------------
app = FastAPI(title="Job Scraper API")

# Router with /api prefix
api = APIRouter(prefix="/api")

# -----------------------------
# ----- CORS Configuration ----
# -----------------------------
from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://enchanting-raindrop-dd802f.netlify.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,   # allow these specific origins
    allow_credentials=True,
    allow_methods=["*"],     # allow all HTTP methods
    allow_headers=["*"],     # allow all headers
)

# -----------------------------
# ----- Database Setup -------
# -----------------------------
models.Base.metadata.create_all(bind=database.engine)

# -----------------------------
# ----- Auth Dependency -------
# -----------------------------
async def get_current_user(
    token: str = Depends(auth.oauth2_scheme),
    db: Session = Depends(database.get_db)
):
    print(f"[DEBUG] Token received: {token[:20]}..." if token else "[DEBUG] No token received")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        print(f"[DEBUG] Email from token: {email}")
        if email is None:
            raise credentials_exception
    except JWTError as e:
        print(f"[DEBUG] JWTError: {e}")
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        print(f"[DEBUG] User not found: {email}")
        raise credentials_exception
    print(f"[DEBUG] User authenticated: {user.email}")
    return user

# -----------------------------
# ----- Root & Docs ----------
# -----------------------------
@app.get("/")
def root():
    return {"message": "Job Scraper API", "docs": "/docs"}

# -----------------------------
# ----- AUTH ROUTES ----------
# -----------------------------
@api.post("/signup")
def signup(body: SignupBody, db: Session = Depends(database.get_db)):
    # Check if user exists
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    # Hash password and create user
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
# ----- JOB SCRAPER ----------
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
def update_application_status(
    application_id: int,
    body: UpdateStatusBody,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
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
# ----- PROFILE CRUD ----------
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

@api.delete("/profile/image")
def delete_image(db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(get_current_user)):
    if current_user.profile_image:
        old = UPLOAD_DIR / Path(current_user.profile_image).name
        if old.exists():
            try:
                old.unlink()
            except OSError:
                pass
    current_user.profile_image = None
    db.commit()
    return {"message": "Image deleted"}

# -----------------------------
# ----- Profile image upload --
# -----------------------------
@api.post("/profile/image")
def upload_profile_image(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Allowed: jpg, jpeg, png, gif, webp")
    name = f"user_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    path = UPLOAD_DIR / name
    contents = file.file.read()
    path.write_bytes(contents)
    rel = f"uploads/{name}"
    if current_user.profile_image:
        old = UPLOAD_DIR / Path(current_user.profile_image).name
        if old.exists():
            try:
                old.unlink()
            except OSError:
                pass
    current_user.profile_image = rel
    db.commit()
    return {"profile_image": rel, "message": "Image uploaded"}

# -----------------------------
# ----- Resume upload ----------
# -----------------------------
ALLOWED_RESUME_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt"}

@api.post("/profile/resume")
def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_RESUME_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Allowed: pdf, doc, docx, txt")
    name = f"resume_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    path = UPLOAD_DIR / name
    contents = file.file.read()
    path.write_bytes(contents)
    rel = f"uploads/{name}"
    if current_user.resume:
        old = UPLOAD_DIR / Path(current_user.resume).name
        if old.exists():
            try:
                old.unlink()
            except OSError:
                pass
    current_user.resume = rel
    db.commit()
    return {"resume": rel, "message": "Resume uploaded"}

@api.delete("/profile/resume")
def delete_resume(db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(get_current_user)):
    if current_user.resume:
        old = UPLOAD_DIR / Path(current_user.resume).name
        if old.exists():
            try:
                old.unlink()
            except OSError:
                pass
    current_user.resume = None
    db.commit()
    return {"message": "Resume deleted"}

# -----------------------------
# ----- AI Tools (bonus) ------
# -----------------------------
@api.get("/ai/health")
def ai_health():
    return {
        "enabled": True,
        "provider": "openai" if os.environ.get("OPENAI_API_KEY") else "heuristic",
    }

def _extract_visible_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text).strip()
    return text

@api.post("/ai/fetch-job")
def ai_fetch_job(body: FetchJobBody):
    try:
        res = requests.get(
            body.url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=15,
        )
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")
    if res.status_code >= 400:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL (status {res.status_code})")
    text = _extract_visible_text_from_html(res.text)
    return {"text": text[:6000]}

def _tokenize_keywords(text: str) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z+.#/]{1,}", text.lower())
    stop = {
        "and","or","the","a","an","to","of","in","for","on","with","as","by","is","are","be","this","that",
        "we","you","your","our","they","their","will","from","at","it","us","if","can","may","should",
        "experience","years","year","role","job","work","working","skills","requirements","responsibilities"
    }
    return [w for w in words if w not in stop and len(w) >= 3]

def _heuristic_analyze(job_text: str, resume_text: str | None, skills: str | None) -> AnalyzeResponse:
    job_tokens = _tokenize_keywords(job_text)
    job_freq: dict[str, int] = {}
    for t in job_tokens:
        job_freq[t] = job_freq.get(t, 0) + 1
    key_skills = [k for k, _ in sorted(job_freq.items(), key=lambda x: x[1], reverse=True)[:12]]

    user_text = (resume_text or "") + " " + (skills or "")
    user_tokens = set(_tokenize_keywords(user_text))
    job_set = set(key_skills[:10])

    overlap = len(job_set & user_tokens)
    denom = max(1, len(job_set))
    match_score = int(round((overlap / denom) * 100))

    missing = [k for k in key_skills if k not in user_tokens][:10]

    parts = re.split(r"(?<=[.!?])\s+", job_text.strip())
    summary_out = " ".join(parts[:2]).strip()
    if not summary_out:
        summary_out = job_text.strip()[:280]
    summary_out = summary_out[:450]

    return AnalyzeResponse(
        summary=summary_out or "Summary not available.",
        key_skills=key_skills[:8],
        match_score=max(0, min(100, match_score)),
        missing_keywords=missing,
    )

def _openai_analyze(job_text: str, resume_text: str | None, skills: str | None) -> AnalyzeResponse:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _heuristic_analyze(job_text, resume_text, skills)

    prompt = (
        "Return JSON with keys: summary, key_skills, match_score, missing_keywords.\n"
        "summary <= 70 words. key_skills 5-10 strings. match_score 0-100. missing_keywords 0-10 strings.\n"
    )
    payload = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"JOB_TEXT:\n{job_text[:9000]}\n\nRESUME_TEXT:\n{(resume_text or '')[:6000]}\n\nSKILLS:\n{(skills or '')[:1500]}"},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=25,
        )
        if r.status_code >= 400:
            return _heuristic_analyze(job_text, resume_text, skills)
        data = r.json()
        content = data["choices"][0]["message"]["content"]
        import json as _json
        parsed = _json.loads(content)
        return AnalyzeResponse(
            summary=str(parsed.get("summary", ""))[:600] or "Summary not available.",
            key_skills=[str(x) for x in (parsed.get("key_skills") or [])][:10],
            match_score=int(parsed.get("match_score", 0)),
            missing_keywords=[str(x) for x in (parsed.get("missing_keywords") or [])][:10],
        )
    except Exception:
        return _heuristic_analyze(job_text, resume_text, skills)

@api.post("/ai/analyze", response_model=AnalyzeResponse)
def ai_analyze(body: AnalyzeBody):
    if not body.job_text or len(body.job_text.strip()) < 30:
        raise HTTPException(status_code=400, detail="job_text is too short")
    return _openai_analyze(body.job_text, body.resume_text, body.skills)


# -----------------------------
# ----- Interview Questions -----
# -----------------------------
def _heuristic_interview_questions(job_text: str, resume_text: str | None) -> InterviewQuestionsResponse:
    """Generate interview questions using heuristic analysis when no OpenAI API key."""
    job_lower = job_text.lower()
    resume_lower = (resume_text or "").lower()
    
    # Extract potential skills from job
    tech_keywords = ["python", "java", "javascript", "react", "node", "sql", "aws", "docker", "kubernetes",
                     "typescript", "nextjs", "fastapi", "postgresql", "mongodb", "redis", "git", "rest", "api",
                     "machine learning", "data analysis", "agile", "scrum", "ci/cd", "linux"]
    
    found_skills = [s for s in tech_keywords if s in job_lower]
    
    # Generate generic questions based on job text
    questions = [
        InterviewQuestionItem(
            question="Tell me about your experience with projects similar to this role.",
            category="General",
            difficulty="Medium"
        ),
        InterviewQuestionItem(
            question="Describe a challenging technical problem you solved recently.",
            category="Technical",
            difficulty="Medium"
        ),
        InterviewQuestionItem(
            question="How do you stay updated with new technologies?",
            category="General",
            difficulty="Easy"
        ),
    ]
    
    # Add skill-specific questions
    for skill in found_skills[:3]:
        questions.append(InterviewQuestionItem(
            question=f"Can you describe your experience with {skill}?",
            category="Technical",
            difficulty="Medium"
        ))
    
    # Add more generic questions
    questions.extend([
        InterviewQuestionItem(
            question="What are your strengths and weaknesses?",
            category="Behavioral",
            difficulty="Easy"
        ),
        InterviewQuestionItem(
            question="Where do you see yourself in 5 years?",
            category="Behavioral",
            difficulty="Easy"
        ),
    ])
    
    tips = [
        "Research the company and role before the interview.",
        "Prepare concrete examples from your past experience.",
        "Practice the STAR method for behavioral questions.",
        "Prepare questions to ask the interviewer.",
    ]
    
    return InterviewQuestionsResponse(questions=questions[:10], tips=tips)


def _openai_interview_questions(job_text: str, resume_text: str | None) -> InterviewQuestionsResponse:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _heuristic_interview_questions(job_text, resume_text)
    
    prompt = (
        "Return JSON with keys: questions (array of objects with question, category, difficulty) and tips (array of strings).\n"
        "Generate 8-12 interview questions relevant to the job. Categories: Technical, Behavioral, General.\n"
        "Difficulty: Easy, Medium, Hard. Include tips for interview preparation.\n"
    )
    payload = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"JOB_DESCRIPTION:\n{job_text[:8000]}\n\nMY_RESUME:\n{(resume_text or 'Not provided')[:4000]}"},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        if r.status_code >= 400:
            return _heuristic_interview_questions(job_text, resume_text)
        data = r.json()
        content = data["choices"][0]["message"]["content"]
        import json as _json
        parsed = _json.loads(content)
        
        questions = [
            InterviewQuestionItem(
                question=str(q.get("question", "")),
                category=str(q.get("category", "General")),
                difficulty=str(q.get("difficulty", "Medium"))
            )
            for q in (parsed.get("questions") or [])[:12]
        ]
        tips = [str(t) for t in (parsed.get("tips") or [])[:6]]
        
        return InterviewQuestionsResponse(questions=questions, tips=tips)
    except Exception:
        return _heuristic_interview_questions(job_text, resume_text)


@api.post("/ai/interview-questions", response_model=InterviewQuestionsResponse)
def ai_interview_questions(body: InterviewQuestionsBody):
    if not body.job_text or len(body.job_text.strip()) < 30:
        raise HTTPException(status_code=400, detail="job_text is too short")
    return _openai_interview_questions(body.job_text, body.resume_text)


# -----------------------------
# ----- Resume Optimizer -------
# -----------------------------
def _heuristic_resume_optimize(job_text: str, resume_text: str) -> ResumeOptimizeResponse:
    """Provide basic resume suggestions using keyword matching."""
    job_tokens = set(_tokenize_keywords(job_text)[:20])
    resume_tokens = set(_tokenize_keywords(resume_text)[:30])
    
    missing = job_tokens - resume_tokens
    suggestions = []
    
    if len(missing) > 5:
        suggestions.append(ResumeSuggestion(
            section="Skills",
            suggestion=f"Consider adding these relevant skills: {', '.join(list(missing)[:7])}",
            priority="high"
        ))
    
    suggestions.extend([
        ResumeSuggestion(
            section="Format",
            suggestion="Keep your resume concise - aim for 1-2 pages maximum.",
            priority="medium"
        ),
        ResumeSuggestion(
            section="Content",
            suggestion="Use action verbs and quantify achievements where possible.",
            priority="medium"
        ),
        ResumeSuggestion(
            section="Keywords",
            suggestion="Tailor your resume for each application by including job-specific keywords.",
            priority="high"
        ),
    ])
    
    # Calculate basic score
    overlap = len(job_tokens & resume_tokens)
    score = min(100, int((overlap / max(1, len(job_tokens))) * 100))
    
    # Generate improved summary
    summary = "Experienced professional with relevant skills in " + ", ".join(list(job_tokens)[:5]) + "."
    
    return ResumeOptimizeResponse(
        overall_score=max(30, score),
        suggestions=suggestions[:6],
        improved_summary=summary
    )


def _openai_resume_optimize(job_text: str, resume_text: str) -> ResumeOptimizeResponse:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _heuristic_resume_optimize(job_text, resume_text)
    
    prompt = (
        "Return JSON with keys: overall_score (0-100), suggestions (array of objects with section, suggestion, priority), "
        "and improved_summary (string under 200 chars).\n"
        "Analyze the resume against the job description and provide actionable improvement suggestions.\n"
    )
    payload = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"JOB_DESCRIPTION:\n{job_text[:8000]}\n\nRESUME:\n{resume_text[:5000]}"},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        if r.status_code >= 400:
            return _heuristic_resume_optimize(job_text, resume_text)
        data = r.json()
        content = data["choices"][0]["message"]["content"]
        import json as _json
        parsed = _json.loads(content)
        
        suggestions = [
            ResumeSuggestion(
                section=str(s.get("section", "General")),
                suggestion=str(s.get("suggestion", "")),
                priority=str(s.get("priority", "medium"))
            )
            for s in (parsed.get("suggestions") or [])[:8]
        ]
        
        return ResumeOptimizeResponse(
            overall_score=int(parsed.get("overall_score", 50)),
            suggestions=suggestions,
            improved_summary=str(parsed.get("improved_summary", ""))[:200]
        )
    except Exception:
        return _heuristic_resume_optimize(job_text, resume_text)


@api.post("/ai/resume-optimize", response_model=ResumeOptimizeResponse)
def ai_resume_optimize(body: ResumeOptimizeBody):
    if not body.job_text or len(body.job_text.strip()) < 30:
        raise HTTPException(status_code=400, detail="job_text is too short")
    if not body.resume_text or len(body.resume_text.strip()) < 30:
        raise HTTPException(status_code=400, detail="resume_text is too short")
    return _openai_resume_optimize(body.job_text, body.resume_text)


# -----------------------------
# ----- Learning Recommendations -
# -----------------------------
# Popular free learning resources by skill
LEARNING_RESOURCES = {
    "python": [
        {"title": "Python Tutorial", "provider": "W3Schools", "url": "https://www.w3schools.com/python/", "format": "course", "is_free": True},
        {"title": "Python for Everybody", "provider": "Coursera", "url": "https://www.coursera.org/specializations/python", "format": "course", "is_free": False},
    ],
    "javascript": [
        {"title": "JavaScript Tutorial", "provider": "W3Schools", "url": "https://www.w3schools.com/js/", "format": "course", "is_free": True},
        {"title": "freeCodeCamp JS", "provider": "freeCodeCamp", "url": "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/", "format": "course", "is_free": True},
    ],
    "react": [
        {"title": "React Tutorial", "provider": "React Docs", "url": "https://react.dev/learn", "format": "course", "is_free": True},
        {"title": "React - The Complete Guide", "provider": "Udemy", "url": "https://www.udemy.com/react-the-complete-guide/", "format": "course", "is_free": False},
    ],
    "typescript": [
        {"title": "TypeScript Tutorial", "provider": "W3Schools", "url": "https://www.w3schools.com/typescript/", "format": "course", "is_free": True},
    ],
    "node": [
        {"title": "Node.js Tutorial", "provider": "W3Schools", "url": "https://www.w3schools.com/nodejs/", "format": "course", "is_free": True},
        {"title": "Node.js Backend Development", "provider": "freeCodeCamp", "url": "https://www.freecodecamp.org/learn/back-end-development-and-apis/", "format": "course", "is_free": True},
    ],
    "sql": [
        {"title": "SQL Tutorial", "provider": "W3Schools", "url": "https://www.w3schools.com/sql/", "format": "course", "is_free": True},
        {"title": "SQL for Data Science", "provider": "Coursera", "url": "https://www.coursera.org/learn/sql-for-data-science", "format": "course", "is_free": False},
    ],
    "aws": [
        {"title": "AWS Cloud Practitioner", "provider": "AWS", "url": "https://aws.amazon.com/training/path-cloudpractitioner/", "format": "course", "is_free": True},
    ],
    "docker": [
        {"title": "Docker Tutorial", "provider": "W3Schools", "url": "https://www.w3schools.com/docker/", "format": "course", "is_free": True},
        {"title": "Docker for Beginners", "provider": "freeCodeCamp", "url": "https://www.freecodecamp.org/news/docker-for-beginers/", "format": "course", "is_free": True},
    ],
    "kubernetes": [
        {"title": "Kubernetes Tutorial", "provider": "W3Schools", "url": "https://www.w3schools.com/kubernetes/", "format": "course", "is_free": True},
    ],
    "postgresql": [
        {"title": "PostgreSQL Tutorial", "provider": "PostgreSQL", "url": "https://www.postgresql.org/docs/", "format": "documentation", "is_free": True},
    ],
    "mongodb": [
        {"title": "MongoDB University", "provider": "MongoDB", "url": "https://university.mongodb.com/", "format": "course", "is_free": True},
    ],
    "git": [
        {"title": "Git Tutorial", "provider": "W3Schools", "url": "https://www.w3schools.com/git/", "format": "course", "is_free": True},
    ],
    "machine learning": [
        {"title": "Machine Learning", "provider": "Coursera", "url": "https://www.coursera.org/learn/machine-learning", "format": "course", "is_free": False},
        {"title": "ML for Beginners", "provider": "Microsoft", "url": "https://github.com/microsoft/ML-For-Beginners", "format": "course", "is_free": True},
    ],
    "data analysis": [
        {"title": "Data Analysis with Python", "provider": "freeCodeCamp", "url": "https://www.freecodecamp.org/learn/data-analysis-with-python/", "format": "course", "is_free": True},
    ],
    "agile": [
        {"title": "Agile Project Management", "provider": "Coursera", "url": "https://www.coursera.org/learn/agile-project-management", "format": "course", "is_free": False},
    ],
}


def _heuristic_learning_recommendations(skills: str, job_text: str | None) -> LearningRecommendationsResponse:
    """Generate learning recommendations based on skills gap."""
    # Parse skills from input
    skill_list = [s.strip().lower() for s in re.split(r'[,\n]', skills) if s.strip()]
    job_skills = []
    if job_text:
        job_skills = _tokenize_keywords(job_text)[:15]
    
    # Find missing skills (from job but not in user skills)
    missing_skills = [s for s in job_skills if s not in skill_list]
    priority_skills = (missing_skills[:5]) if missing_skills else skill_list[:5]
    
    recommendations = []
    for skill in priority_skills:
        # Find exact or partial match in our resources
        skill_key = next((k for k in LEARNING_RESOURCES if k in skill or skill in k), None)
        if skill_key:
            for res in LEARNING_RESOURCES[skill_key]:
                if len(recommendations) < 10:
                    recommendations.append(LearningResource(**res))
        else:
            # Generic recommendation for unknown skills
            if len(recommendations) < 10:
                recommendations.append(LearningResource(
                    title=f"Learn {skill.title()}",
                    provider="Online Resources",
                    url=f"https://www.google.com/search?q=learn+{skill}",
                    format="article",
                    is_free=True
                ))
    
    # Add some general resources if list is short
    if len(recommendations) < 3:
        recommendations.append(LearningResource(
            title="Full Stack Web Development",
            provider="freeCodeCamp",
            url="https://www.freecodecamp.org/",
            format="course",
            is_free=True
        ))
    
    return LearningRecommendationsResponse(
        recommendations=recommendations[:8],
        priority_skills=priority_skills
    )


def _openai_learning_recommendations(skills: str, job_text: str | None) -> LearningRecommendationsResponse:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _heuristic_learning_recommendations(skills, job_text)
    
    prompt = (
        "Return JSON with keys: recommendations (array of objects with title, provider, url, format, is_free) "
        "and priority_skills (array of strings).\n"
        "Provide learning resources for the skills that need improvement. Include both free and paid options.\n"
    )
    payload = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"MY_SKILLS:\n{skills}\n\nJOB_DESCRIPTION:\n{(job_text or 'Not provided')[:5000]}"},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        if r.status_code >= 400:
            return _heuristic_learning_recommendations(skills, job_text)
        data = r.json()
        content = data["choices"][0]["message"]["content"]
        import json as _json
        parsed = _json.loads(content)
        
        recommendations = [
            LearningResource(
                title=str(r.get("title", "")),
                provider=str(r.get("provider", "")),
                url=str(r.get("url", "")),
                format=str(r.get("format", "course")),
                is_free=bool(r.get("is_free", True))
            )
            for r in (parsed.get("recommendations") or [])[:10]
        ]
        priority_skills = [str(s) for s in (parsed.get("priority_skills") or [])[:6]]
        
        return LearningRecommendationsResponse(recommendations=recommendations, priority_skills=priority_skills)
    except Exception:
        return _heuristic_learning_recommendations(skills, job_text)


@api.post("/ai/learning-recommendations", response_model=LearningRecommendationsResponse)
def ai_learning_recommendations(body: LearningRecommendationsBody):
    if not body.skills or len(body.skills.strip()) < 2:
        raise HTTPException(status_code=400, detail="skills is required")
    return _openai_learning_recommendations(body.skills, body.job_text)

# -----------------------------
# ----- Static files (uploads) -
# -----------------------------
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# -----------------------------
# ----- Include Router -------
# -----------------------------
app.include_router(api)