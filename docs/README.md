# CS2 Analytics Documentation

> Technical and business documentation for the CS2 Analytics platform.

## Documentation Structure

```
docs/
├── README.md                    # This file
├── business-rules/              # Functional business rules
│   └── demo-access-control.md   # Demo visibility & access rules
└── (planned)
    ├── architecture/            # System architecture docs
    ├── api/                     # API reference
    └── guides/                  # Developer guides
```

## Business Rules

Business rules define the functional behavior of the platform. They are written for both technical and non-technical stakeholders.

| Document | Description | Status |
|----------|-------------|--------|
| [Dashboard Authentication](./business-rules/dashboard-authentication.md) | Protected routes & auth flow | Implemented |
| [Demo Access Control](./business-rules/demo-access-control.md) | Who can see which demos | Implemented |

## Quick Links

- **Codebase**: [GitHub Repository](https://github.com/your-org/cs2-analytics)
- **API Base URL**: `http://localhost:3000/v1` (development)
- **Frontend**: `http://localhost:3001` (development)

## Contributing to Documentation

1. Use Markdown for all documentation
2. Follow the existing structure and naming conventions
3. Include "Last Updated" dates in documents
4. Link related files in the "Related Documentation" section
5. Keep documents focused and scannable
