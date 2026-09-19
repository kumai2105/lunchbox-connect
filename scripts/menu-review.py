"""Export the 82 unpublished menu drafts as a review workbook for the owner."""
import sqlite3
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

DB = "/home/claude/projects/jazeel-web/data/jazeel.db"
OUT = "/home/claude/Jazeel-Menu-Review.xlsx"

INK = "1A1512"
FLAME = "C2571F"
GOLD = "B98B34"
BONE = "F6F1E8"
FILL_EDIT = PatternFill("solid", fgColor="FFF6D9")
FILL_HEAD = PatternFill("solid", fgColor=INK)
FILL_BAND = PatternFill("solid", fgColor=BONE)
THIN = Side(style="thin", color="D8D2C6")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

A = "Arial"
H1 = Font(name=A, size=16, bold=True, color=INK)
H2 = Font(name=A, size=11, bold=True, color="FFFFFF")
BODY = Font(name=A, size=10, color=INK)
BODY_B = Font(name=A, size=10, bold=True, color=INK)
MUTED = Font(name=A, size=10, color="6B6259")
NOTE = Font(name=A, size=10, italic=True, color="6B6259")
ACCENT = Font(name=A, size=11, bold=True, color=FLAME)

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
rows = list(
    conn.execute(
        """select mc.name_en cat, mc.sort csort, mi.name_en, mi.price_fils, mi.id
           from menu_items mi join menu_categories mc on mc.id = mi.category_id
           order by mc.sort, mi.sort"""
    )
)
assert len(rows) == 82, len(rows)

wb = Workbook()

# ------------------------------------------------------------------ start here
s = wb.active
s.title = "Start here"
s.sheet_view.showGridLines = False
s.column_dimensions["A"].width = 3
s.column_dimensions["B"].width = 82
s.column_dimensions["C"].width = 14

def line(r, text, font=BODY, height=None):
    s.cell(r, 2, text).font = font
    s.cell(r, 2).alignment = Alignment(wrap_text=True, vertical="top")
    if height:
        s.row_dimensions[r].height = height

line(2, "Jazeel — menu review", H1)
line(3, "Everything the website needs before the menu can go live.", MUTED)

line(5, "What this is", ACCENT)
line(
    6,
    "The only menu found anywhere public is a delivery snapshot taken on 31 August 2026. "
    "All 82 items from it are already loaded into the website as unpublished drafts — nothing "
    "is visible to the public, and nothing will be until you approve it here. These prices are "
    "delivery prices from a third-party platform. None of them has been confirmed by you.",
    BODY,
    58,
)

line(8, "What to do", ACCENT)
for i, t in enumerate(
    [
        "1.  Open the 'Menu items' tab. Every yellow cell is yours to fill in; the white cells are "
        "what the delivery platform showed.",
        "2.  For each item: mark Keep as Y or N, and put the correct dine-in price in the price "
        "column. If the name is wrong, write the right one in the next column.",
        "3.  Open the 'Missing items' tab and add the drinks, desserts, breakfast and kids items. "
        "There is not a single drink on any public source — for a café, that is the biggest gap.",
        "4.  Arabic names are optional but valuable: the Arabic site is built and waiting for them.",
        "5.  Send the file back. I load it in and the menu page goes live with real, approved prices.",
    ]
):
    line(9 + i, t, BODY, 30)

line(15, "Two things worth knowing", ACCENT)
line(
    16,
    "Descriptions and allergens are not asked for here. Descriptions can come later without "
    "holding up launch. Allergens are a separate exercise against the nine categories Dubai "
    "Municipality requires, and it is better done properly than quickly.",
    BODY,
    44,
)
line(
    18,
    "You do not have to use this file. Everything in it can also be edited directly in the "
    "website admin, under Menu. The spreadsheet just makes it easier to work through with the "
    "kitchen, and to hand to someone else.",
    BODY,
    44,
)

line(20, "Progress", ACCENT)
prog = [
    ("Items in the draft menu", '=COUNTA(\'Menu items\'!C3:C84)'),
    ("Marked keep (Y)", '=COUNTIF(\'Menu items\'!F3:F84,"Y")'),
    ("Marked remove (N)", '=COUNTIF(\'Menu items\'!F3:F84,"N")'),
    ("Still undecided", '=COUNTBLANK(\'Menu items\'!F3:F84)'),
    ("Dine-in prices confirmed", '=COUNT(\'Menu items\'!H3:H84)'),
    ("Arabic names supplied", '=COUNTA(\'Menu items\'!D3:D84)'),
    ("New items added", '=COUNTA(\'Missing items\'!B5:B130)'),
]
for i, (label, f) in enumerate(prog):
    r = 21 + i
    s.cell(r, 2, label).font = BODY
    c = s.cell(r, 3, f)
    c.font = BODY_B
    c.alignment = Alignment(horizontal="right")
    c.border = BOX

line(
    30,
    "These counts update as you type. When 'Still undecided' reaches nil and every kept item "
    "has a price, the file is ready to come back.",
    NOTE,
    28,
)

# ------------------------------------------------------------------ menu items
m = wb.create_sheet("Menu items")
m.sheet_view.showGridLines = False
m.freeze_panes = "A3"

cols = [
    ("#", 5, False),
    ("Category", 24, False),
    ("Item, as listed on the delivery platform", 38, False),
    ("Arabic name", 24, True),
    ("Delivery price (AED)", 15, False),
    ("Keep? Y / N", 11, True),
    ("Correct name, if different", 30, True),
    ("Dine-in price (AED)", 15, True),
    ("Delivery price, if it differs", 15, True),
    ("Notes for me", 34, True),
]
m.cell(1, 1, "Menu items — 82 drafts from the delivery snapshot of 31 August 2026").font = H1
m.cell(1, 1).alignment = Alignment(vertical="center")
m.row_dimensions[1].height = 30

for i, (name, width, editable) in enumerate(cols, start=1):
    c = m.cell(2, i, name)
    c.font = H2
    c.fill = FILL_HEAD
    c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
    c.border = BOX
    m.column_dimensions[get_column_letter(i)].width = width
m.row_dimensions[2].height = 34

prev_cat = None
for n, r in enumerate(rows):
    row = 3 + n
    new_cat = r["cat"] != prev_cat
    prev_cat = r["cat"]
    vals = [
        n + 1,
        r["cat"] if new_cat else "",
        r["name_en"],
        None,
        r["price_fils"] / 100,
        None,
        None,
        None,
        None,
        None,
    ]
    for i, v in enumerate(vals, start=1):
        c = m.cell(row, i, v)
        c.font = BODY_B if i == 2 else BODY
        c.border = BOX
        c.alignment = Alignment(vertical="center", wrap_text=i in (3, 7, 10))
        if cols[i - 1][2]:
            c.fill = FILL_EDIT
        if i in (5, 8, 9):
            c.number_format = "0.00"
            c.alignment = Alignment(horizontal="right", vertical="center")
        if i == 1:
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.font = MUTED
    if new_cat and n:
        for i in range(1, 11):
            m.cell(row, i).border = Border(
                left=THIN, right=THIN, bottom=THIN, top=Side(style="medium", color=GOLD)
            )

yn = DataValidation(type="list", formula1='"Y,N"', allow_blank=True, showErrorMessage=True)
yn.error = "Enter Y to keep this item on the menu, or N to drop it."
yn.errorTitle = "Y or N"
m.add_data_validation(yn)
yn.add(f"F3:F{2 + len(rows)}")

last = 2 + len(rows)
m.cell(last + 2, 3, "Total of the kept items' dine-in prices").font = MUTED
tot = m.cell(last + 2, 8, f"=SUMIF(F3:F{last},\"Y\",H3:H{last})")
tot.font = BODY_B
tot.number_format = "0.00"
m.cell(last + 3, 3, "Prices shown in white are delivery prices from Deliveroo on 31 Aug 2026 "
                    "and have not been confirmed by the business.").font = NOTE

# ---------------------------------------------------------------- missing items
x = wb.create_sheet("Missing items")
x.sheet_view.showGridLines = False
x.freeze_panes = "A4"
x.cell(1, 1, "Missing items — nothing here appears on any public source").font = H1
x.row_dimensions[1].height = 30
x.cell(2, 1, "Add one row per item. The suggested sections below are the gaps the research "
             "found; add or ignore as you see fit. Row 3 is an example — overwrite it.").font = NOTE
x.row_dimensions[2].height = 20

xcols = [
    ("Section", 24),
    ("Item name (English)", 34),
    ("Arabic name", 26),
    ("Dine-in price (AED)", 15),
    ("Portion / size", 20),
    ("Notes", 34),
]
for i, (name, width) in enumerate(xcols, start=1):
    c = x.cell(3, i, name)
    c.font = H2
    c.fill = FILL_HEAD
    c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
    c.border = BOX
    x.column_dimensions[get_column_letter(i)].width = width
x.row_dimensions[3].height = 30

example = ["Hot drinks", "Turkish coffee", "قهوة تركية", 15.00, "Single", "Example row — replace"]
for i, v in enumerate(example, start=1):
    c = x.cell(4, i, v)
    c.font = NOTE
    c.border = BOX
    c.fill = FILL_BAND
    if i == 4:
        c.number_format = "0.00"

sections = [
    ("Hot drinks", 10, "Arabic coffee, Turkish coffee, tea, espresso drinks"),
    ("Cold drinks and juices", 10, "Fresh juices, cocktails, mocktails"),
    ("Soft drinks and water", 6, ""),
    ("Desserts", 8, "Nothing public exists for these"),
    ("Breakfast", 8, "Served from 10:00 — no breakfast item is published anywhere"),
    ("Kids", 6, "The children's area is confirmed; a kids menu is not"),
    ("Shisha", 6, "Hold until the legal position on advertising tobacco is confirmed"),
]
r = 5
for name, count, hint in sections:
    hc = x.cell(r, 1, name)
    hc.font = BODY_B
    hc.fill = FILL_BAND
    for i in range(2, 7):
        x.cell(r, i).fill = FILL_BAND
    if hint:
        h = x.cell(r, 6, hint)
        h.font = NOTE
        h.fill = FILL_BAND
    r += 1
    for _ in range(count):
        for i in range(1, 7):
            c = x.cell(r, i)
            c.border = BOX
            c.fill = FILL_EDIT
            c.font = BODY
            if i == 4:
                c.number_format = "0.00"
        r += 1
    r += 1

wb.save(OUT)
print("written", OUT)
