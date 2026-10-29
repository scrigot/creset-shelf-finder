import os
from datetime import date, timedelta

from sqlalchemy import select

from .db import SessionLocal
from .models import Activity, Prospect, Settings

TODAY = date.today()

PROSPECTS = [
    # name, type, address, miles, members, 18-34, women, athlete, fridge, supps, warm, stage, next action, due offset, notes, lat, lng
    ("UNC Campus Recreation", "campus rec", "101 Student Recreation Center, Chapel Hill, NC", 0.6, 2600, 84, 52, "high", True, False, "Dana in Rec Ops — met at the wellness fair", "Sampling", "Drop samples at the front desk", -2, "Trial window runs through November; want a cooler by the field house.", 35.9060, -79.0485),
    ("Chapel Hill Strength Club", "strength", "123 E Franklin St, Chapel Hill, NC", 0.4, 420, 79, 38, "high", True, True, "Coach Miles trains our intern", "Meeting", "Bring two cases to Tuesday session", 0, "Asked about a 6-week trial priced per case.", 35.9187, -79.0545),
    ("Carrboro Iron Works", "strength", "207 Roberson St, Carrboro, NC", 1.8, 260, 72, 35, "high", False, True, "", "Reached out", "Follow up on sample request", -6, "Owner wants to see the nutrition label before sampling.", 35.9106, -79.0749),
    ("Franklin Street CrossFit", "crossfit", "431 W Franklin St, Chapel Hill, NC", 1.2, 310, 76, 44, "high", True, False, "Owner knows our brand from the Games", "Stocked", "Restock check-in", 4, "Selling 2 cases a week off the front desk.", 35.9144, -79.0634),
    ("Meadowmont CrossFit", "crossfit", "1201 Meadowmont Village Cir, Chapel Hill, NC", 2.9, 240, 70, 47, "med", False, False, "", "Not contacted", "", None, "Coach list from the regional throwdown.", 35.9056, -79.0086),
    ("The Hive Fitness Boutique", "boutique", "300 W Rosemary St, Chapel Hill, NC", 0.9, 180, 74, 78, "med", False, False, "Introduced by Sarah at Fleet Feet", "Reached out", "Send intro email plus deck", 1, "Studio doubles as a recovery lounge.", 35.9137, -79.0590),
    ("Tar Heel Run Club", "run club", "140 W Franklin St, Chapel Hill, NC", 0.7, 350, 88, 55, "med", False, False, "President is a UNC senior", "Meeting", "Coffee meeting at Sutton's", 2, "Wednesday night runs end on Franklin, good sampling spot.", 35.9156, -79.0580),
    ("Carolina Spin & Sculpt", "yoga/spin", "1500 E Franklin St, Chapel Hill, NC", 1.6, 300, 66, 82, "low", True, True, "", "Not contacted", "", None, "Fridge in the lobby per their site.", 35.9234, -79.0419),
    ("Estes Drive Fitness", "big-box", "201 S Estes Dr, Chapel Hill, NC", 2.2, 2400, 58, 49, "low", True, True, "GM open to a cooler placement test", "Sampling", "Confirm cooler install date", -1, "Cooler by the front desk, 90-day test.", 35.9218, -79.0377),
    ("Durham Iron District", "strength", "330 W Main St, Durham, NC", 9.8, 520, 71, 34, "high", True, True, "", "Reached out", "Second follow-up call", -5, "Powerlifting-heavy floor, high protein interest.", 35.9962, -78.9067),
    ("Ninth Street Athletic", "boutique", "807 9th St, Durham, NC", 9.1, 200, 68, 71, "med", False, False, "Met at the Bull City wellness expo", "Meeting", "Sample drop at front desk", 3, "Small studio, strong community feel.", 36.0075, -78.9232),
    ("Bull City CrossFit", "crossfit", "719 N Mangum St, Durham, NC", 9.4, 290, 74, 42, "high", True, False, "", "Not contacted", "", None, "Referral from Franklin Street CF.", 36.0006, -78.8981),
    ("Eno River Run Club", "run club", "610 W Murray Ave, Durham, NC", 11.2, 180, 81, 58, "med", False, False, "", "Not contacted", "", None, "Trail-focused, weekend long runs.", 36.0299, -78.9218),
    ("RTP Performance Lab", "strength", "4000 S Miami Blvd, Durham, NC", 12.4, 380, 69, 30, "high", True, True, "Warm intro via an NC State athletics alum", "Reached out", "Pilot proposal follow-up", 5, "Caters to shift workers; considers a subscription pilot.", 35.9000, -78.8550),
    ("Southern Village Strength", "strength", "600 Market St, Chapel Hill, NC", 3.1, 230, 73, 41, "med", False, True, "", "Lost", "Revisit next quarter", 30, "Went with a competing brand for Q3.", 35.8843, -79.0493),
    ("Glen Lennox CrossFit", "crossfit", "100 Hamilton Rd, Chapel Hill, NC", 3.4, 210, 72, 46, "med", True, False, "", "Not contacted", "", None, "Redeveloped space, new ownership.", 35.9120, -79.0188),
    ("Fordham Blvd O2 Fitness", "big-box", "1728 Fordham Blvd, Chapel Hill, NC", 2.6, 1800, 61, 50, "low", True, True, "Regional buyer asked for samples", "Reached out", "Send pricing sheet", -3, "Buyer reviews new SKUs monthly.", 35.9180, -79.0203),
    ("Orangetheory Chapel Hill", "boutique", "1800 E Franklin St, Chapel Hill, NC", 2.4, 420, 70, 64, "med", True, False, "", "Not contacted", "", None, "Class-based, high turnover of members.", 35.9250, -79.0385),
    ("Yoga Garden Carrboro", "yoga/spin", "1 Boyd St, Carrboro, NC", 1.9, 260, 64, 84, "low", False, False, "", "Not contacted", "", None, "Mindful brand fit, less athlete focus.", 35.9100, -79.0735),
    ("Carmichael Arena Training", "campus rec", "310 South Rd, Chapel Hill, NC", 0.8, 900, 86, 48, "high", True, False, "Athletics nutrition staff intro", "Sampling", "Deliver four cases before Friday", 0, "Strength staff want it in the coolers before the home game.", 35.9005, -79.0440),
    ("CrossFit Local Carrboro", "crossfit", "200 N Greensboro St, Carrboro, NC", 2.1, 170, 71, 43, "med", False, False, "", "Not contacted", "", None, "Tiny box, owner runs everything himself.", 35.9116, -79.0712),
    ("UNC Wellness Center", "campus rec", "100 Sprunt St, Chapel Hill, NC", 1.4, 1200, 80, 55, "high", True, True, "Director is a family friend", "Meeting", "Present pilot terms", -4, "Wants a campus-wide student discount angle.", 35.9040, -79.0300),
    ("FitLab Durham", "boutique", "2020 Chapel Hill Rd, Durham, NC", 7.6, 240, 67, 59, "med", False, True, "", "Reached out", "Nudge about sample kit", 6, "Interested in a small-batch trial.", 36.0055, -78.9450),
    ("Triangle Barbell Club", "strength", "420 Weaver Dairy Rd, Chapel Hill, NC", 4.2, 190, 75, 33, "high", False, True, "", "Not contacted", "", None, "Competitive lifters, heavy supplement spend.", 35.9350, -79.0430),
    ("Hillsborough Run Crew", "run club", "100 S Churton St, Hillsborough, NC", 8.9, 140, 79, 61, "med", False, False, "", "Not contacted", "", None, "Saturday runs only, harder to catch.", 36.0754, -79.0997),
]


def seed() -> None:
    """Populate the pipeline the first time the database is empty."""
    if os.environ.get("SEED_DEMO_DATA", "1") != "1":
        return
    with SessionLocal() as session:
        if session.scalars(select(Prospect).limit(1)).first() is not None:
            return

        for row in PROSPECTS:
            (
                name, kind, address, miles, members, pct_young, pct_women, athlete,
                fridge, supps, warm, stage, next_action, offset, notes, lat, lng,
            ) = row
            prospect = Prospect(
                name=name,
                type=kind,
                address=address,
                distance_miles=miles,
                members=members,
                pct_18_34=pct_young,
                pct_women=pct_women,
                athlete_focus=athlete,
                has_drink_fridge=fridge,
                sells_supplements=supps,
                warm_intro=warm,
                stage=stage,
                next_action=next_action,
                next_action_date=TODAY + timedelta(days=offset) if offset is not None else None,
                notes=notes,
                lat=lat,
                lng=lng,
            )
            session.add(prospect)
            session.flush()
            session.add(
                Activity(
                    prospect_id=prospect.id,
                    kind="system",
                    body=f"Added to pipeline · stage {stage}",
                )
            )

        session.add(Settings(id=1))
        session.commit()
