"""Tema escuro inspirado no WOD Timer web."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

COLORS = {
    "bg": "#1a1f24",
    "panel": "#242b32",
    "panel_alt": "#2d3640",
    "input": "#2d3640",
    "border": "#3d4a56",
    "text": "#e8edf2",
    "muted": "#7a8794",
    "accent": "#00e5ff",
    "accent_dim": "#0a6b78",
    "accent_on": "#0a1218",
    "danger": "#ff5c5c",
    "success": "#3dd68c",
}


def apply_theme(root: tk.Tk) -> None:
    root.configure(bg=COLORS["bg"])

    style = ttk.Style(root)
    try:
        style.theme_use("clam")
    except tk.TclError:
        pass

    common = {
        "background": COLORS["bg"],
        "foreground": COLORS["text"],
        "font": ("SF Pro Text", 13),
    }

    style.configure(".", **common)
    style.configure("TFrame", background=COLORS["bg"])
    style.configure("Card.TFrame", background=COLORS["panel"], relief="flat")
    style.configure("CardInner.TFrame", background=COLORS["panel"])
    style.configure("Toolbar.TFrame", background=COLORS["bg"])
    style.configure("Footer.TFrame", background=COLORS["bg"])

    style.configure(
        "TLabel",
        background=COLORS["bg"],
        foreground=COLORS["text"],
        font=("SF Pro Text", 13),
    )
    style.configure(
        "Title.TLabel",
        background=COLORS["bg"],
        foreground=COLORS["text"],
        font=("SF Pro Display", 22, "bold"),
    )
    style.configure(
        "Subtitle.TLabel",
        background=COLORS["bg"],
        foreground=COLORS["muted"],
        font=("SF Pro Text", 12),
    )
    style.configure(
        "Muted.TLabel",
        background=COLORS["panel"],
        foreground=COLORS["muted"],
        font=("SF Pro Text", 11),
    )
    style.configure(
        "CardTitle.TLabel",
        background=COLORS["panel"],
        foreground=COLORS["text"],
        font=("SF Pro Text", 14, "bold"),
    )
    style.configure(
        "Badge.TLabel",
        background=COLORS["accent_dim"],
        foreground=COLORS["accent"],
        font=("SF Pro Text", 11, "bold"),
        padding=(8, 2),
    )
    style.configure(
        "Status.TLabel",
        background=COLORS["bg"],
        foreground=COLORS["muted"],
        font=("SF Pro Text", 12),
    )
    style.configure(
        "Field.TLabel",
        background=COLORS["panel"],
        foreground=COLORS["muted"],
        font=("SF Pro Text", 11),
    )

    style.configure(
        "TLabelframe",
        background=COLORS["panel"],
        foreground=COLORS["muted"],
        bordercolor=COLORS["border"],
        relief="solid",
        borderwidth=1,
    )
    style.configure(
        "TLabelframe.Label",
        background=COLORS["panel"],
        foreground=COLORS["muted"],
        font=("SF Pro Text", 11, "bold"),
    )

    style.configure(
        "TEntry",
        fieldbackground=COLORS["input"],
        foreground=COLORS["text"],
        insertcolor=COLORS["accent"],
        bordercolor=COLORS["border"],
        lightcolor=COLORS["border"],
        darkcolor=COLORS["border"],
        padding=6,
    )
    style.map(
        "TEntry",
        fieldbackground=[("focus", COLORS["panel_alt"])],
        bordercolor=[("focus", COLORS["accent"])],
    )

    style.configure(
        "TCombobox",
        fieldbackground=COLORS["input"],
        background=COLORS["input"],
        foreground=COLORS["text"],
        arrowcolor=COLORS["accent"],
        bordercolor=COLORS["border"],
        padding=6,
    )
    style.map(
        "TCombobox",
        fieldbackground=[("readonly", COLORS["input"])],
        selectbackground=[("readonly", COLORS["accent_dim"])],
        selectforeground=[("readonly", COLORS["text"])],
    )

    style.configure(
        "TButton",
        background=COLORS["panel_alt"],
        foreground=COLORS["text"],
        bordercolor=COLORS["border"],
        focusthickness=0,
        padding=(14, 8),
        font=("SF Pro Text", 12),
    )
    style.map(
        "TButton",
        background=[("active", COLORS["border"]), ("pressed", COLORS["accent_dim"])],
        foreground=[("active", COLORS["text"])],
    )

    style.configure(
        "Accent.TButton",
        background=COLORS["accent"],
        foreground=COLORS["accent_on"],
        bordercolor=COLORS["accent"],
        font=("SF Pro Text", 13, "bold"),
        padding=(18, 10),
    )
    style.map(
        "Accent.TButton",
        background=[("active", "#33ebff"), ("pressed", COLORS["accent_dim"])],
        foreground=[("active", COLORS["accent_on"])],
    )

    style.configure(
        "Ghost.TButton",
        background=COLORS["panel"],
        foreground=COLORS["accent"],
        bordercolor=COLORS["border"],
        padding=(12, 6),
    )
    style.map(
        "Ghost.TButton",
        background=[("active", COLORS["panel_alt"])],
    )

    style.configure(
        "Danger.TButton",
        background=COLORS["panel"],
        foreground=COLORS["danger"],
        bordercolor=COLORS["border"],
        padding=(10, 4),
    )
    style.map(
        "Danger.TButton",
        background=[("active", "#3a2224")],
    )

    style.configure(
        "TCheckbutton",
        background=COLORS["panel"],
        foreground=COLORS["text"],
        font=("SF Pro Text", 12),
    )
    style.map(
        "TCheckbutton",
        background=[("active", COLORS["panel"])],
        foreground=[("active", COLORS["text"])],
    )

    style.configure(
        "Vertical.TScrollbar",
        background=COLORS["panel_alt"],
        troughcolor=COLORS["bg"],
        bordercolor=COLORS["bg"],
        arrowcolor=COLORS["muted"],
    )


def bind_mousewheel(widget: tk.Widget, scroll_target: tk.Canvas) -> None:
    def on_wheel(event: tk.Event) -> None:
        if event.delta:
            scroll_target.yview_scroll(int(-event.delta / 120), "units")
        elif event.num == 4:
            scroll_target.yview_scroll(-1, "units")
        elif event.num == 5:
            scroll_target.yview_scroll(1, "units")

    widget.bind("<Enter>", lambda _e: widget.bind_all("<MouseWheel>", on_wheel))
    widget.bind("<Leave>", lambda _e: widget.unbind_all("<MouseWheel>"))
    widget.bind("<Enter>", lambda _e: widget.bind_all("<Button-4>", on_wheel))
    widget.bind("<Enter>", lambda _e: widget.bind_all("<Button-5>", on_wheel))
