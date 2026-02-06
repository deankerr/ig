# Tags Design

## Philosophy

Tags are a universal, schema-less attribute primitive. A tag is a string with no inherent meaning - its significance comes entirely from whatever client or system feature interprets it. There are zero requirements for any tag to exist.

This gives us:

- **Zero-migration features.** Favourites, collections, client user tracking, NSFW flags - all implemented by writing a string. The server never changes.
- **Client autonomy.** A Discord bot invents `discord:channel:123`, a CLI invents `session:xyz`. No coordination with ig needed.
- **No sparse columns.** No table full of NULLs documenting feature history instead of data.

## Schema

Tags are extracted from the generations table into a junction table, supporting both generations and outputs as taggable resources.

```sql
CREATE TABLE tags (
  resource_type TEXT NOT NULL,  -- 'generation' | 'output'
  resource_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,  -- Unix ms
  PRIMARY KEY (resource_type, resource_id, tag)
);

CREATE INDEX idx_tags_lookup ON tags(tag, resource_type, resource_id);
CREATE INDEX idx_tags_resource ON tags(resource_id, resource_type);
```

### Why a junction table?

The current system stores tags as a JSON array column. Filtering requires `json_each()` per row per tag - a full table scan with JSON parsing. `listTags` cross-joins the entire table with `json_each()` to extract distinct values.

The junction table gives indexed lookups in both directions:

- **Resources for a tag:** `SELECT resource_id FROM tags WHERE tag = 'anime' AND resource_type = 'generation'` - index scan on `idx_tags_lookup`
- **Tags for a resource:** `SELECT tag FROM tags WHERE resource_id = ? AND resource_type = 'generation'` - index scan on `idx_tags_resource`
- **All distinct tags:** `SELECT DISTINCT tag FROM tags` - no JSON parsing
- **Tag counts:** `SELECT tag, COUNT(*) FROM tags GROUP BY tag` - trivial

### Trade-offs

- **More writes** - one INSERT per tag per resource, instead of a JSON array update. Writes are infrequent compared to reads.
- **Duplicated tag text** - `"anime"` stored once per tagged resource instead of once in a lookup table. Strings are cheap, and a normalised `tag_names` table adds joins and IDs for minimal savings.

## Namespace Convention

System-generated tags use the `ig:` prefix. This is a convention, not an enforcement mechanism.

| Prefix | Owner | Examples |
|--------|-------|---------|
| `ig:` | ig system | `ig:regenerate:01HQX...` |
| _(none)_ | Client/user | `anime`, `landscape`, `favourite` |
| `{app}:` | Client apps (optional) | `discord:channel:123`, `cli:session:xyz` |

The console UI filters `ig:*` tags from display by default. Clients can adopt their own prefixes or not - ig doesn't care.

## Validation

- Tag: non-empty string, max 256 characters, trimmed
- Max 20 tags per resource (enforced at API layer)

## API

Tags are passed at creation time and managed via dedicated add/remove operations.

### Create generation with tags

```
POST /api/generations
{
  "model": "civitai:108@1",
  "input": { ... },
  "tags": ["landscape", "test"],
}
```

Tags are inserted into the junction table after the generation record is created.

### Tag/untag a resource

```
PATCH /api/tags
{
  "resourceType": "output",
  "resourceId": "01HQX...",
  "add": ["favourite"],
  "remove": ["draft"]
}
```

### List all tags

```
GET /api/tags?resourceType=generation

{ "tags": ["anime", "landscape", "test", ...] }
```

### Filter by tags

Tags are a filter parameter on list endpoints:

```
GET /api/generations?tags=anime,landscape
```

Translates to:

```sql
SELECT g.* FROM generations g
WHERE EXISTS (SELECT 1 FROM tags t WHERE t.resource_id = g.id AND t.resource_type = 'generation' AND t.tag = 'anime')
  AND EXISTS (SELECT 1 FROM tags t WHERE t.resource_id = g.id AND t.resource_type = 'generation' AND t.tag = 'landscape')
ORDER BY g.created_at DESC
```

Both subqueries hit `idx_tags_lookup`.

## Output-Level Tagging

With the `outputs` table from the redesign and `resource_type = 'output'`, tagging individual images is first-class:

```sql
-- Favourite a specific output
INSERT INTO tags (resource_type, resource_id, tag, created_at)
VALUES ('output', '01HQX...', 'favourite', 1234567890);

-- All favourited outputs
SELECT resource_id FROM tags
WHERE tag = 'favourite' AND resource_type = 'output';
```

## Migration

Existing JSON tag data migrated to the junction table:

```sql
INSERT INTO tags (resource_type, resource_id, tag, created_at)
SELECT 'generation', g.id, j.value, g.created_at
FROM generations g, json_each(g.tags) j
WHERE g.tags != '[]';
```

After migration, drop the `tags` column from `generations`.
