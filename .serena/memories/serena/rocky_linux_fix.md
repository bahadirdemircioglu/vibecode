# Serena — Rocky Linux / RHEL Fix

## Problem
Rocky Linux (ve muhtemelen diğer RHEL tabanlı distro'larda) Serena MCP başlatılamıyor.

## Kök Neden
`.mcp.json`'daki Serena komutunda `mcp` yerine `start-mcp-server` kullanılmalı.

**Yanlış:**
```json
"args": ["--from", "git+https://github.com/oraios/serena", "serena", "mcp"]
```

**Doğru:**
```json
"args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd"]
```

## Kontrol
`.mcp.json` oluşturulurken veya düzenlenirken bu komutun doğru olduğundan emin ol.
