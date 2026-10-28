from sqlalchemy import select

from .db import SessionLocal
from .models import Item, Shelf

SHELVES = [
    ("Library West", "Library"),
    ("Hall Cabinet", "Entrance Hall"),
    ("Study Alcove", "Study"),
    ("Attic Archive", "Attic"),
]

ITEMS = [
    ("Ravensworth Crest Plaque", "Raven rampant on a silver chevron", "Plaque", "A2", "Library West"),
    ("Kestrel Rampant Goblet", "Kestrel with spread wings above three oak leaves", "Drinkware", "B1", "Hall Cabinet"),
    ("Marlowe Seal Ring", "Interlaced M between three mullets", "Jewelry", "C3", "Study Alcove"),
    ("Ashcombe Shield Miniature", "Three ash leaves on a bend sinister", "Plaque", "A4", "Library West"),
    ("Wexford Tankard", "Boar's head erased above a mural crown", "Drinkware", "B2", "Hall Cabinet"),
    ("Thorne Bookplate Set", "Thorn bush surmounted by a crescent", "Paper", "D1", "Attic Archive"),
    ("Ellsworth Snuff Box", "Chevron between three annulets", "Curio", "C1", "Study Alcove"),
    ("Harrowgate Letter Seal", "Stag trippant beneath an oak sprig", "Curio", "D2", "Attic Archive"),
    ("Bellwether Brass Medallion", "Bell between two olive branches", "Medallion", "A1", "Library West"),
    ("Fairholm Dessert Spoon", "Falcon close above a fess wavy", "Silverware", "B3", "Hall Cabinet"),
]


def seed() -> None:
    """Populate a demo collection the first time the database is empty."""
    with SessionLocal() as session:
        if session.scalars(select(Shelf).limit(1)).first() is not None:
            return

        shelves = {name: Shelf(name=name, room=room) for name, room in SHELVES}
        session.add_all(shelves.values())
        session.flush()

        session.add_all(
            Item(
                name=name,
                crest=crest,
                category=category,
                slot=slot,
                shelf_id=shelves[shelf].id,
            )
            for name, crest, category, slot, shelf in ITEMS
        )
        session.commit()
