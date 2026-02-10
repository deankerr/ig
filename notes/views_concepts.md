# Views Concepts

Hypothetical views a frontend might expect to have.

## Primary Views

90% of the time, you are looking at one of these. Little to no filtering. Sorted by most recently created.

### "The Home Page Feed"

- All my recent images as thumbnails
- Think "iPhone Photos app" - dead simple, everyone understands this, most prefer it as their primary means of navigating even huge collections
- Videos too!
- In progress? Errors?
  - (maybe), (probably not)
- batch representation not critical. artifacts would likely naturally appear sequentially (but not necessarily)
- click artifact -> modal with metadata, big preview. link to original/download etc.
  - we must have/fetch the 'generation' record at this point. we show `input` params
  - thumbnail view to navigate batch items?

### "The Crafting Bench"

- Split screen view - one side is generation controls (model, prompt, sizes, batch, etc.), the other side a feed of requests/generations.
- "generation" focus. shows a feed of generations, sorted by most recently created
- one generation per "row". artifact previews/thumbnails - batch items together.
- you would expect a placeholder "generating" thumbnail while waiting
- and therefore an "error" thumbnail if failed
- metadata can either be shown with thumbnails, or behind a click through -> modal/sheet.
- click on artifact or click on generation? or both?
- is this essentially the same view as the Home Page Feed modal?
  - But we also support error states here

### "The Modal"

- I've pretty much outlined it prior, but we need the artifact and generation.
- Optionally, any related batch artifacts.
- This is a natural place to query the DO, maybe only automatically if there is an error condition of some sort.

## Secondary Views

Derived or custom views, either by applying filters to primary views, or a result of user-contributed metadata.

Sorting by most recent is an inbuilt requirement, therefore can filter by period if needed.

### "Collections"

- Albums, essentially. Obviously an artifact is not restricted to being in a single collection.
- By artifact. Can contain any kind of artifact, we don't care.
- The concept at its base is 'tags' - arbitrary groups with a label, indexed.
- NOT 'generations' - at least not directly. it's extremely convenient to supply tags up front in the request that will be applied automatically to any artifacts yielded.
- Spicy take: we can piggyback on the exact same system for internal use cases, that aren't part of a rigid schema.

### "Filter by X"

- Artifacts:
  - Definitely: Model.
  - Would be nice: Prompt (FTS)
  - Negative prompt - probably not.
  - Never: CFGScale, scheduler, etc.
  - Output type, as in JPG/PNG - I don't think so.
  - "Kind" (we don't currently model this, but image, video etc.)
  - Generation ID (batch)
  - Seed? Maybe yeah.
  - Cost? Not sure.
- Generations:
  - Technically much of the same "input" param data as artifacts
    - But we could also just filter by artifact... when do we care more about a generation than an artifact for this?
  - Status - although more like "has error"
  - "Kind" or `taskType` in runware terms
  - "Has artifact" ... but if we know about an artifact we can get it's generation

### Joins

- Mix and match categories, filters, anything else we come up with.
- Here be dragons.
- But if we get the schema right, not so bad.

## Advice

- Why do we store data? So that we can query it.
- Why do we query data? So that we can view it.
