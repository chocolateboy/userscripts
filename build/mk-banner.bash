#!/usr/bin/bash

# https://www.davidpashley.com/articles/writing-robust-shell-scripts/
# http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

file="$1"
pattern='/==UserScript==/,/==\/UserScript==/'
header=`awk "$pattern" "$file"`
comment="// NOTE This file is generated from $file and should not be edited directly."
banner="$header\n\n$comment"

# trailing newlines are trimmed by command substitution, so they're added in
# the caller
echo -e "$banner"
