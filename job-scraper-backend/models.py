from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    profile_image = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    skills = Column(String, nullable=True)
    resume = Column(String, nullable=True)

class ApplicationHistory(Base):
    __tablename__ = "application_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    job_title = Column(String)
    company = Column(String)
    platform = Column(String)
    job_link = Column(String)
    applied_date = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="Applied")
