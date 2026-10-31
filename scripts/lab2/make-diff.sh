#!/usr/bin/env bash
# Diff для верифікатора (Лаб. 2, крок 03): звичайний git diff, але еталонний набір — з повним
# контекстом файлу, щоб суддя бачив усі запити, а не лише змінені рядки (калібрування 2, c05/A2).
#   bash scripts/lab2/make-diff.sh main...HEAD > docs/lab2/verify-input.diff
set -euo pipefail
range="${1:?вкажіть діапазон, наприклад main...HEAD}"
git diff "$range" -- . ':(exclude)docs/lab2/golden/queries.jsonl'
git diff -U100000 "$range" -- docs/lab2/golden/queries.jsonl
