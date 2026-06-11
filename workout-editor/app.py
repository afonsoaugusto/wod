#!/usr/bin/env python3
"""Cadastro local de workouts para o WOD Timer."""

from __future__ import annotations

from typing import Callable

import tkinter as tk
from tkinter import messagebox, ttk

from constants import (
    CATEGORIES,
    CATEGORY_LABELS,
    EXERCISE_VIEW_LABELS,
    EXERCISE_VIEWS,
    MODE_LABELS,
    MODES,
    WEIGHT_UNITS,
)
from ui_theme import COLORS, apply_theme, bind_mousewheel
from workout_io import (
    default_block,
    default_exercise,
    default_workout,
    list_workout_ids,
    load_workout,
    normalize_workout,
    save_workout,
    slugify,
    update_index,
)

EXERCISE_COLUMNS = (
    {"key": "name", "label": "Nome", "minsize": 200, "weight": 1},
    {"key": "reps", "label": "Reps", "minsize": 88, "weight": 0},
    {"key": "weightM", "label": "Peso M", "minsize": 88, "weight": 0},
    {"key": "weightF", "label": "Peso F", "minsize": 88, "weight": 0},
    {"key": "restSeconds", "label": "Descanso (s)", "minsize": 96, "weight": 0},
)
EXERCISE_ACTION_MINSIZE = 40


def configure_exercise_columns(frame: tk.Misc) -> None:
    for col, column in enumerate(EXERCISE_COLUMNS):
        frame.columnconfigure(col, minsize=column["minsize"], weight=column["weight"])
    frame.columnconfigure(len(EXERCISE_COLUMNS), minsize=EXERCISE_ACTION_MINSIZE, weight=0)


class ScrollableFrame(ttk.Frame):
    def __init__(
        self,
        parent: tk.Misc,
        *,
        height: int = 200,
        scrollbar_parent: tk.Misc | None = None,
        scrollbar_row: int = 0,
        scrollbar_col: int = 1,
        scrollbar_rowspan: int = 1,
    ) -> None:
        super().__init__(parent, style="CardInner.TFrame")
        self.columnconfigure(0, weight=1)
        self.rowconfigure(0, weight=1)

        self.canvas = tk.Canvas(
            self,
            highlightthickness=0,
            bg=COLORS["panel"],
            borderwidth=0,
            height=height,
        )
        scrollbar_host = scrollbar_parent if scrollbar_parent is not None else self
        self.scrollbar = ttk.Scrollbar(scrollbar_host, orient=tk.VERTICAL, command=self.canvas.yview)
        self.inner = ttk.Frame(self.canvas, style="CardInner.TFrame")

        self.inner.bind("<Configure>", self._on_inner_configure)
        self.window_id = self.canvas.create_window((0, 0), window=self.inner, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)

        self.canvas.grid(row=0, column=0, sticky="nsew")
        if scrollbar_parent is None:
            self.scrollbar.grid(row=0, column=1, sticky="ns")
        else:
            self.scrollbar.grid(
                row=scrollbar_row,
                column=scrollbar_col,
                rowspan=scrollbar_rowspan,
                sticky="ns",
            )

        self.canvas.bind("<Configure>", self._on_canvas_configure)
        bind_mousewheel(self.canvas, self.canvas)
        bind_mousewheel(self.inner, self.canvas)

    def _on_canvas_configure(self, event: tk.Event) -> None:
        self.canvas.itemconfigure(self.window_id, width=event.width)

    def _on_inner_configure(self, _event: tk.Event | None = None) -> None:
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def scroll_to_bottom(self) -> None:
        self.update_idletasks()
        self.canvas.yview_moveto(1.0)


class BlockPanel(ttk.Frame):
    def __init__(
        self,
        parent: tk.Misc,
        *,
        index: int,
        on_change: Callable[[], None],
        on_remove: Callable[["BlockPanel"], None],
        data: dict | None = None,
    ) -> None:
        super().__init__(parent, style="Card.TFrame", padding=14)
        self.on_change = on_change
        self.on_remove = on_remove
        self.index = index
        self._mode_fields: dict[str, dict] = {}
        self._exercise_rows: list[dict[str, tk.Variable]] = []

        data = data or default_block()
        self._build_ui()
        self.load_data(data)
        self._refresh_mode_fields()

    def _build_ui(self) -> None:
        self.columnconfigure(0, weight=1)

        header = ttk.Frame(self, style="CardInner.TFrame")
        header.grid(row=0, column=0, sticky="ew")
        header.columnconfigure(1, weight=1)

        self.category_var = tk.StringVar(value="wod")
        category = ttk.Frame(header, style="CardInner.TFrame")
        category.grid(row=0, column=0, sticky="w")
        ttk.Label(category, text="Tipo", style="Field.TLabel").pack(anchor="w")
        self.category_combo = ttk.Combobox(
            category,
            textvariable=self.category_var,
            values=[CATEGORY_LABELS[c] for c in CATEGORIES],
            state="readonly",
            width=16,
        )
        self.category_combo.pack(anchor="w", pady=(4, 0))
        self.category_combo.bind("<<ComboboxSelected>>", self._handle_category_change)

        self.badge = ttk.Label(header, text=f"Bloco {self.index}", style="Badge.TLabel")
        self.badge.grid(row=0, column=1, sticky="e", padx=(12, 12))

        ttk.Button(
            header,
            text="Remover bloco",
            style="Danger.TButton",
            command=lambda: self.on_remove(self),
        ).grid(row=0, column=2, sticky="e")

        config = ttk.Frame(self, style="CardInner.TFrame")
        config.grid(row=1, column=0, sticky="ew", pady=(14, 0))
        for col in (1, 3, 5):
            config.columnconfigure(col, weight=1)

        self.mode_var = tk.StringVar(value=MODE_LABELS["fortime"])
        self.work_seconds_var = tk.StringVar(value="60")
        self.rest_seconds_var = tk.StringVar(value="15")
        self.interval_var = tk.StringVar(value="60")
        self.total_minutes_var = tk.StringVar(value="12")
        self.time_cap_var = tk.StringVar(value="0")
        self.tabata_rounds_var = tk.StringVar(value="8")
        self.exercise_view_var = tk.StringVar(value=EXERCISE_VIEW_LABELS["list"])

        ttk.Label(config, text="Modo", style="Field.TLabel").grid(row=0, column=0, sticky="w")
        mode_combo = ttk.Combobox(
            config,
            textvariable=self.mode_var,
            values=[MODE_LABELS[m] for m in MODES],
            state="readonly",
            width=16,
        )
        mode_combo.grid(row=0, column=1, sticky="w", padx=(8, 16))
        mode_combo.bind("<<ComboboxSelected>>", self._refresh_mode_fields)

        self.mode_frame = ttk.Frame(config, style="CardInner.TFrame")
        self.mode_frame.grid(row=1, column=0, columnspan=6, sticky="ew", pady=(10, 0))

        self._add_mode_field("workSeconds", "Trabalho (s)", self.work_seconds_var, modes={"sequential"})
        self._add_mode_field("restSeconds", "Descanso padrão (s)", self.rest_seconds_var, modes={"sequential"})
        self._add_mode_field("intervalSeconds", "Intervalo EMOM (s)", self.interval_var, modes={"emom"})
        self._add_mode_field("totalMinutes", "Total EMOM (min)", self.total_minutes_var, modes={"emom"})
        self._add_mode_field("tabataRounds", "Rounds Tabata", self.tabata_rounds_var, modes={"tabata"})
        self._add_mode_field("timeCapMinutes", "Time cap (min, 0 = sem limite)", self.time_cap_var, modes={"amrap", "fortime"})

        ttk.Label(config, text="Exibição no treino", style="Field.TLabel").grid(row=2, column=0, sticky="w", pady=(10, 0))
        ttk.Combobox(
            config,
            textvariable=self.exercise_view_var,
            values=[EXERCISE_VIEW_LABELS[v] for v in EXERCISE_VIEWS],
            state="readonly",
            width=18,
        ).grid(row=2, column=1, sticky="w", padx=(8, 0), pady=(10, 0))

        ttk.Label(self, text="Exercícios", style="CardTitle.TLabel").grid(row=2, column=0, sticky="w", pady=(16, 8))

        table = ttk.Frame(self, style="CardInner.TFrame")
        table.grid(row=3, column=0, rowspan=2, sticky="nsew")
        table.columnconfigure(0, weight=1)
        table.rowconfigure(1, weight=1)
        self.rowconfigure(3, weight=1)

        self.exercise_header = ttk.Frame(table, style="CardInner.TFrame")
        self.exercise_header.grid(row=0, column=0, sticky="ew", pady=(0, 4))
        configure_exercise_columns(self.exercise_header)
        for col, column in enumerate(EXERCISE_COLUMNS):
            ttk.Label(
                self.exercise_header,
                text=column["label"],
                style="Field.TLabel",
                anchor="w",
            ).grid(row=0, column=col, sticky="ew", padx=(0, 6))

        self.exercise_scroll = ScrollableFrame(
            table,
            height=180,
            scrollbar_parent=table,
            scrollbar_row=0,
            scrollbar_col=1,
            scrollbar_rowspan=2,
        )
        self.exercise_scroll.grid(row=1, column=0, sticky="nsew")
        self.exercise_container = self.exercise_scroll.inner

        actions = ttk.Frame(self, style="CardInner.TFrame")
        actions.grid(row=5, column=0, sticky="ew", pady=(10, 0))
        ttk.Button(actions, text="+ Exercício", style="Ghost.TButton", command=self.add_exercise_row).pack(side=tk.LEFT)

    def _add_mode_field(self, key: str, label: str, variable: tk.StringVar, *, modes: set[str]) -> None:
        frame = ttk.Frame(self.mode_frame, style="CardInner.TFrame")
        ttk.Label(frame, text=label, style="Field.TLabel").pack(anchor="w")
        ttk.Entry(frame, textvariable=variable, width=12).pack(anchor="w", pady=(4, 0))
        self._mode_fields[key] = {"frame": frame, "modes": modes}

    def _refresh_mode_fields(self, *_args) -> None:
        mode = self._mode_key()
        col = 0
        for item in self._mode_fields.values():
            item["frame"].grid_forget()
        for item in self._mode_fields.values():
            if mode in item["modes"]:
                item["frame"].grid(row=0, column=col, sticky="w", padx=(0, 14), pady=4)
                col += 1

    def _handle_category_change(self, _event=None) -> None:
        self.on_change()

    def set_index(self, index: int) -> None:
        self.index = index
        self.badge.configure(text=f"Bloco {index}")

    def _category_key(self) -> str:
        label = self.category_var.get()
        for key, value in CATEGORY_LABELS.items():
            if value == label:
                return key
        return "wod"

    def _mode_key(self) -> str:
        label = self.mode_var.get()
        for key, value in MODE_LABELS.items():
            if value == label:
                return key
        return "fortime"

    def _exercise_view_key(self) -> str:
        label = self.exercise_view_var.get()
        for key, value in EXERCISE_VIEW_LABELS.items():
            if value == label:
                return key
        return "list"

    def load_data(self, data: dict) -> None:
        self.category_var.set(CATEGORY_LABELS.get(data.get("category", "wod"), "WOD"))
        self.mode_var.set(MODE_LABELS.get(data.get("mode", "fortime"), "For Time"))
        self.work_seconds_var.set(str(data.get("workSeconds", 60)))
        self.rest_seconds_var.set(str(data.get("restSeconds", 15)))
        self.interval_var.set(str(data.get("intervalSeconds", 60)))
        self.total_minutes_var.set(str(data.get("totalMinutes", 12)))
        self.time_cap_var.set(str(data.get("timeCapMinutes", 0)))
        self.tabata_rounds_var.set(str(data.get("tabataRounds", 8)))
        self.exercise_view_var.set(EXERCISE_VIEW_LABELS.get(data.get("exerciseView", "list"), "Lista completa"))
        self._set_exercises(data.get("exercises") or [default_exercise()])

    def _set_exercises(self, exercises: list[dict]) -> None:
        for child in self.exercise_container.winfo_children():
            child.destroy()
        self._exercise_rows.clear()
        for exercise in exercises or [default_exercise()]:
            self.add_exercise_row(exercise, scroll=False)
        self.exercise_scroll._on_inner_configure()

    def add_exercise_row(self, exercise: dict | None = None, *, scroll: bool = True) -> None:
        exercise = exercise or default_exercise()
        row_frame = ttk.Frame(self.exercise_container, style="CardInner.TFrame")
        row_frame.pack(fill=tk.X, pady=3)

        vars_map = {
            "name": tk.StringVar(value=exercise.get("name", "")),
            "reps": tk.StringVar(value=exercise.get("reps", "")),
            "weightM": tk.StringVar(value=exercise.get("weightM", "")),
            "weightF": tk.StringVar(value=exercise.get("weightF", "")),
            "restSeconds": tk.StringVar(value=exercise.get("restSeconds", "")),
        }
        configure_exercise_columns(row_frame)
        for col, column in enumerate(EXERCISE_COLUMNS):
            ttk.Entry(row_frame, textvariable=vars_map[column["key"]]).grid(
                row=0, column=col, sticky="ew", padx=(0, 6), pady=2
            )

        ttk.Button(
            row_frame,
            text="×",
            style="Danger.TButton",
            width=3,
            command=lambda frame=row_frame, row=vars_map: self.remove_exercise_row(frame, row),
        ).grid(row=0, column=len(EXERCISE_COLUMNS), padx=(0, 0))

        self._exercise_rows.append(vars_map)
        self.exercise_scroll._on_inner_configure()
        if scroll:
            self.after(20, self.exercise_scroll.scroll_to_bottom)

    def remove_exercise_row(self, frame: ttk.Frame, row: dict[str, tk.Variable]) -> None:
        if row in self._exercise_rows:
            self._exercise_rows.remove(row)
        frame.destroy()
        if not self._exercise_rows:
            self.add_exercise_row(scroll=False)
        self.exercise_scroll._on_inner_configure()

    def collect(self) -> dict:
        exercises = [{key: var.get().strip() for key, var in row.items()} for row in self._exercise_rows]
        return {
            "category": self._category_key(),
            "mode": self._mode_key(),
            "workSeconds": int(self.work_seconds_var.get() or 0),
            "restSeconds": int(self.rest_seconds_var.get() or 0),
            "intervalSeconds": int(self.interval_var.get() or 0),
            "totalMinutes": int(self.total_minutes_var.get() or 0),
            "timeCapMinutes": int(self.time_cap_var.get() or 0),
            "tabataRounds": int(self.tabata_rounds_var.get() or 0),
            "exerciseView": self._exercise_view_key(),
            "exercises": exercises,
        }


class WorkoutEditorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("WOD Timer — Cadastro de treinos")
        self.geometry("980x820")
        self.minsize(860, 680)
        apply_theme(self)

        self._blocks: list[BlockPanel] = []
        self._block_wrappers: list[tk.Frame] = []
        self._loading = False

        self._build_ui()
        self.new_workout()

    def _build_ui(self) -> None:
        outer = ttk.Frame(self, padding=16)
        outer.pack(fill=tk.BOTH, expand=True)
        outer.columnconfigure(0, weight=1)
        outer.rowconfigure(2, weight=1)

        top = ttk.Frame(outer, style="Toolbar.TFrame")
        top.grid(row=0, column=0, sticky="ew")
        top.columnconfigure(0, weight=1)

        ttk.Label(top, text="Cadastro de workouts", style="Title.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(
            top,
            text="Crie e edite treinos no mesmo formato do app web",
            style="Subtitle.TLabel",
        ).grid(row=1, column=0, sticky="w", pady=(4, 12))

        toolbar = ttk.Frame(top, style="Toolbar.TFrame")
        toolbar.grid(row=2, column=0, sticky="ew", pady=(0, 4))
        ttk.Label(toolbar, text="Abrir").pack(side=tk.LEFT)
        self.load_var = tk.StringVar()
        self.load_combo = ttk.Combobox(toolbar, textvariable=self.load_var, state="readonly", width=24)
        self.load_combo.pack(side=tk.LEFT, padx=(8, 8))
        ttk.Button(toolbar, text="Carregar", command=self.load_selected).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(toolbar, text="Novo", command=self.new_workout).pack(side=tk.LEFT)
        ttk.Button(toolbar, text="Atualizar índice", command=self.refresh_index).pack(side=tk.LEFT, padx=(12, 0))

        meta_card = ttk.LabelFrame(outer, text="Informações do treino", padding=14)
        meta_card.grid(row=1, column=0, sticky="ew", pady=(8, 12))
        for col in (1, 3):
            meta_card.columnconfigure(col, weight=1)

        self.name_var = tk.StringVar()
        self.id_var = tk.StringVar()
        self.description_var = tk.StringVar()
        self.classic_var = tk.BooleanVar(value=False)
        self.rest_var = tk.StringVar(value="0")
        self.unit_var = tk.StringVar(value="lb")

        ttk.Label(meta_card, text="Nome", style="Field.TLabel").grid(row=0, column=0, sticky="w")
        name_entry = ttk.Entry(meta_card, textvariable=self.name_var)
        name_entry.grid(row=0, column=1, sticky="ew", padx=(8, 16))
        name_entry.bind("<FocusOut>", self._sync_id_from_name)

        ttk.Label(meta_card, text="Id (arquivo)", style="Field.TLabel").grid(row=0, column=2, sticky="w")
        ttk.Entry(meta_card, textvariable=self.id_var).grid(row=0, column=3, sticky="ew", padx=(8, 0))

        ttk.Label(meta_card, text="Descrição", style="Field.TLabel").grid(row=1, column=0, sticky="nw", pady=(10, 0))
        ttk.Entry(meta_card, textvariable=self.description_var).grid(
            row=1, column=1, columnspan=3, sticky="ew", padx=(8, 0), pady=(10, 0)
        )

        flags = ttk.Frame(meta_card, style="CardInner.TFrame")
        flags.grid(row=2, column=0, columnspan=4, sticky="w", pady=(12, 0))
        ttk.Checkbutton(flags, text="Treino padrão (★ no app)", variable=self.classic_var).pack(side=tk.LEFT)
        ttk.Label(flags, text="Descanso entre blocos (s)", style="Field.TLabel").pack(side=tk.LEFT, padx=(20, 6))
        ttk.Entry(flags, textvariable=self.rest_var, width=8).pack(side=tk.LEFT)
        ttk.Label(flags, text="Unidade", style="Field.TLabel").pack(side=tk.LEFT, padx=(16, 6))
        ttk.Combobox(flags, textvariable=self.unit_var, values=WEIGHT_UNITS, state="readonly", width=6).pack(side=tk.LEFT)

        blocks_wrap = ttk.LabelFrame(outer, text="Blocos do treino", padding=10)
        blocks_wrap.grid(row=2, column=0, sticky="nsew")
        blocks_wrap.columnconfigure(0, weight=1)
        blocks_wrap.rowconfigure(0, weight=1)

        self.blocks_scroll = ScrollableFrame(blocks_wrap, height=420)
        self.blocks_scroll.grid(row=0, column=0, sticky="nsew")
        self.blocks_container = self.blocks_scroll.inner
        self.blocks_container.columnconfigure(0, weight=1)

        ttk.Button(
            blocks_wrap,
            text="+ Bloco",
            style="Ghost.TButton",
            command=lambda: self.add_block("wod"),
        ).grid(row=1, column=0, sticky="w", pady=(10, 0))

        footer = ttk.Frame(outer, style="Footer.TFrame")
        footer.grid(row=3, column=0, sticky="ew", pady=(14, 0))
        footer.columnconfigure(0, weight=1)
        self.status_var = tk.StringVar(value="Pronto.")
        ttk.Label(footer, textvariable=self.status_var, style="Status.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Button(footer, text="Salvar workout", style="Accent.TButton", command=self.save_current).grid(
            row=0, column=1, sticky="e"
        )

        self.refresh_workout_list()

    def _sync_id_from_name(self, _event=None) -> None:
        if self._loading or self.id_var.get().strip():
            return
        slug = slugify(self.name_var.get())
        if slug:
            self.id_var.set(slug)

    def _renumber_blocks(self) -> None:
        for index, block in enumerate(self._blocks, start=1):
            block.set_index(index)

    def _clear_blocks(self) -> None:
        for wrapper in self._block_wrappers:
            wrapper.destroy()
        self._blocks.clear()
        self._block_wrappers.clear()

    def add_block(self, category: str = "wod", data: dict | None = None, *, scroll: bool = True) -> None:
        if data is None:
            data = default_block()
            data["category"] = category

        wrapper = tk.Frame(self.blocks_container, bg=COLORS["border"], padx=1, pady=1)
        wrapper.grid(row=len(self._blocks), column=0, sticky="ew", pady=(0, 12))

        panel = BlockPanel(
            wrapper,
            index=len(self._blocks) + 1,
            on_change=self._on_blocks_changed,
            on_remove=self.remove_block,
            data=data,
        )
        panel.pack(fill=tk.X, expand=True)
        self._blocks.append(panel)
        self._block_wrappers.append(wrapper)
        self.blocks_scroll._on_inner_configure()
        if scroll:
            self.after(20, self.blocks_scroll.scroll_to_bottom)

    def remove_block(self, panel: BlockPanel) -> None:
        if panel not in self._blocks:
            return
        index = self._blocks.index(panel)
        self._block_wrappers[index].destroy()
        self._blocks.pop(index)
        self._block_wrappers.pop(index)
        for row, wrapper in enumerate(self._block_wrappers):
            wrapper.grid(row=row, column=0, sticky="ew", pady=(0, 12))
        self._renumber_blocks()
        self.blocks_scroll._on_inner_configure()

    def _on_blocks_changed(self) -> None:
        self.blocks_scroll._on_inner_configure()

    def _set_blocks(self, block_list: list[dict]) -> None:
        self._clear_blocks()
        if not block_list:
            return
        for block in block_list:
            self.add_block(data=block, scroll=False)
        self.blocks_scroll.canvas.yview_moveto(0)

    def refresh_workout_list(self) -> None:
        ids = list_workout_ids()
        self.load_combo["values"] = ids
        if ids:
            current = self.load_var.get()
            self.load_var.set(current if current in ids else ids[0])
        else:
            self.load_var.set("")

    def refresh_index(self) -> None:
        count = update_index()
        self.refresh_workout_list()
        self.status_var.set(f"index.json atualizado ({count} treinos).")

    def new_workout(self) -> None:
        self._loading = True
        self._apply_workout(default_workout())
        self._loading = False
        self.status_var.set("Novo treino.")

    def load_selected(self) -> None:
        workout_id = self.load_var.get().strip()
        if not workout_id:
            messagebox.showinfo("Carregar", "Nenhum treino disponível.")
            return
        try:
            data = normalize_workout(load_workout(workout_id))
        except FileNotFoundError as err:
            messagebox.showerror("Carregar", str(err))
            return
        self._loading = True
        self._apply_workout(data)
        self._loading = False
        self.status_var.set(f"Carregado: {workout_id}.json")

    def _apply_workout(self, data: dict) -> None:
        self.name_var.set(data["name"])
        self.id_var.set(data["id"])
        self.description_var.set(data["description"])
        self.classic_var.set(data["classic"])
        self.rest_var.set(str(data["config"]["restBetweenBlocks"]))
        self.unit_var.set(data["config"]["weightUnit"])
        self._set_blocks(data["config"]["blockList"])

    def _collect_workout(self) -> dict:
        return {
            "id": self.id_var.get().strip(),
            "name": self.name_var.get().strip(),
            "description": self.description_var.get().strip(),
            "classic": self.classic_var.get(),
            "config": {
                "restBetweenBlocks": int(self.rest_var.get() or 0),
                "weightUnit": self.unit_var.get(),
                "blockList": [block.collect() for block in self._blocks],
            },
        }

    def save_current(self) -> None:
        data = normalize_workout(self._collect_workout())
        try:
            path = save_workout(data)
        except ValueError as err:
            messagebox.showerror("Validação", str(err))
            return
        except OSError as err:
            messagebox.showerror("Erro ao salvar", str(err))
            return

        self.refresh_workout_list()
        self.load_var.set(data["id"])
        self.status_var.set(f"Salvo em {path.name}")
        messagebox.showinfo("Salvo", f"Workout gravado em:\n{path}")


def main() -> None:
    app = WorkoutEditorApp()
    app.mainloop()


if __name__ == "__main__":
    main()
