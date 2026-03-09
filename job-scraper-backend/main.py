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
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
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

# -----------------------------
# ----- AI Endpoints ---------
# -----------------------------
@api.get("/ai/health")
def ai_health():
    return {"enabled": True, "provider": "openai" if os.environ.get("OPENAI_API_KEY") else "heuristic"}

# -----------------------------
# ----- Static Files ---------
# -----------------------------
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# -----------------------------
# ----- Include Router -------
# -----------------------------
app.include_router(api)