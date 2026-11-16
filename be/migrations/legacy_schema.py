"""Frozen pre-hardening DDL; historical revisions never import live ORM models."""

import json
from pathlib import Path

import sqlalchemy as sa


def create_legacy_tables(bind, names=None):
    existing = set(sa.inspect(bind).get_table_names())
    for table in json.loads(
        Path(__file__).with_name("legacy_schema.json").read_text(encoding="utf-8")
    ):
        if (names is None or table["name"] in names) and table["name"] not in existing:
            bind.exec_driver_sql(table["table"])
            for statement in table["indexes"]:
                bind.exec_driver_sql(statement)
