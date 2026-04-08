from fastapi import APIRouter

from app.api.v1 import auth, cvs, gap_analysis, matches, offers, profile

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(cvs.router)
api_router.include_router(profile.router)
api_router.include_router(offers.router)
api_router.include_router(matches.router)
api_router.include_router(gap_analysis.router)
