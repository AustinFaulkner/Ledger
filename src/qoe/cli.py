"""`qoe` command-line interface."""

from __future__ import annotations

from pathlib import Path

import typer
from rich import print as rprint

from . import diligence, ingest, llm, qoe
from .config import settings

app = typer.Typer(help="AI-assisted Quality of Earnings & diligence analysis.")


@app.command()
def doctor() -> None:
    """Check that the resolved provider + API token are working."""
    rprint(f"resolved: {llm.resolved()}")
    rprint(f"models:   reasoning=[cyan]{settings.model_reasoning}[/]  fast=[cyan]{settings.model_fast}[/]")
    try:
        rprint(f"[green]OK[/] — model responded: {llm.ping()!r}")
    except Exception as e:  # noqa: BLE001 - surface any connectivity/auth error
        rprint(f"[red]FAILED[/] — {e}")
        raise typer.Exit(1)


@app.command()
def ingest_(path: str = typer.Argument(..., help="Data-room directory")) -> None:
    """Parse and chunk a data room (prints a summary; index build is TODO)."""
    chunks = ingest.load_dir(path)
    rprint(f"[green]Loaded {len(chunks)} chunks[/] from {path}")


# typer uses the function name as the command; alias to `ingest`.
app.command(name="ingest")(ingest_)


@app.command("qoe")
def run_qoe(path: str = typer.Argument(..., help="Dir or file with financials")) -> None:
    """Run the Quality-of-Earnings pass over the financials in `path`."""
    chunks = ingest.load_dir(path) if Path(path).is_dir() else ingest.load_file(Path(path))
    financials = "\n\n".join(c.text for c in chunks)
    report = qoe.analyze(financials)
    rprint(report.model_dump())


@app.command()
def ask(question: str, path: str = typer.Option("data/sample", help="Data room")) -> None:
    """Ask a diligence question with cited answers."""
    index = diligence.build_index(ingest.load_dir(path))
    rprint(diligence.ask(index, question).model_dump())


if __name__ == "__main__":
    app()
