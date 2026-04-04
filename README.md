# Arcanon Patterns

Detection patterns for [Arcanon Scanner](https://github.com/arcanon-dev/arcanon-scanner). The scanner fetches these patterns at startup to detect HTTP clients, message queues, databases, gRPC, and other service connections across 7 languages.

**Endpoint:** `https://patterns.arcanon.dev/v1/patterns.json`

## How It Works

```
arcanon-scanner startup:
  1. Fetch patterns from https://patterns.arcanon.dev/v1/patterns.json
  2. Cache locally (~/.arcanon/patterns.json)
  3. Merge with .arcanon.toml [[patterns]] overrides
  4. Scan codebase using compiled plugins (routes) + dynamic patterns (connections)
```

The scanner's compiled plugins handle complex AST-based detection (framework routes, two-phase extraction, monorepo scoping). These patterns handle the simpler content-gate + line-scan detection (which library is imported, what calls it makes).

## Pattern Structure

Each language has a JSON file in `patterns/`:

```json
{
  "id": "py-redis",
  "name": "redis-py",
  "description": "Redis client for Python",
  "import_gate": ["import redis", "from redis"],
  "detections": [
    {
      "match": "Redis(",
      "kind": "connection",
      "protocol": "redis",
      "confidence": "high",
      "target_extraction": "first_string_arg"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique ID (lowercase, hyphens) |
| `name` | Human-readable library name |
| `description` | What this pattern detects |
| `import_gate` | File must contain one of these strings (fast skip) |
| `detections[].match` | Line must contain this string |
| `detections[].kind` | `connection` or `endpoint` |
| `detections[].protocol` | Free string: `redis`, `kafka`, `amqp`, `postgresql`, etc. |
| `detections[].confidence` | `high`, `medium`, `low` |
| `detections[].target_extraction` | How to extract target: `none`, `first_string_arg`, `url_hostname`, `named_arg:<key>` |

## Languages

| Language | File | Patterns | Protocols |
|----------|------|----------|-----------|
| TypeScript | `typescript.json` | 20 | rest, kafka, amqp, nats, redis, mongodb, postgresql, mysql, sqlite, grpc, elasticsearch |
| Python | `python.json` | 20 | rest, amqp, kafka, celery, nats, redis, postgresql, mongodb, grpc, sqs, sns, dynamodb, elasticsearch, modbus, opcua |
| Go | `go.json` | 10 | rest, grpc, kafka, amqp, nats, redis, mongodb, postgresql, elasticsearch |
| Java | `java.json` | 11 | rest, kafka, amqp, grpc, redis, mongodb, postgresql, nats, elasticsearch |
| C# | `csharp.json` | 13 | rest, postgresql, mssql, sqlite, amqp, azure-servicebus, redis, mongodb, grpc, nats, kafka, elasticsearch |
| Rust | `rust.json` | 10 | rest, grpc, amqp, kafka, redis, postgresql, mysql, sqlite, mongodb, nats, modbus |
| Ruby | `ruby.json` | 12 | rest, amqp, redis, mongodb, kafka, grpc, nats, elasticsearch |

## Contributing

Add a new detection pattern:

1. Edit the appropriate `patterns/<language>.json` file
2. Add your pattern following the schema above
3. Run validation: `npm run validate`
4. Submit a PR

**Guidelines:**
- `import_gate` should be specific enough to avoid false positives (use import statement, not just library name)
- `match` should include the opening parenthesis to avoid matching comments/variable names
- Set `confidence: "medium"` if the pattern could match non-library code
- Test against a real codebase before submitting

## Development

```bash
npm install
npm run validate    # check all patterns against schema
npm run build       # merge into public/v1/patterns.json
```

## Deployment

Deployed to Vercel. On merge to main:

1. `npm run validate` — schema check
2. `npm run build` — merge per-language files into `public/v1/patterns.json`
3. Vercel serves from edge with 1-hour cache + 24-hour stale-while-revalidate
