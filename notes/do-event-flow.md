# GenerationDO Event Flow

The DO is a coordination register — it validates and tracks state but does no heavy I/O.
All CDN fetching, R2 storage, and D1 writes happen at the Worker level via `waitUntil`.

```mermaid
sequenceDiagram
    participant Client
    participant Router as Router (Worker)
    participant Runware as Runware API
    participant DO as GenerationDO
    participant BG as waitUntil (Worker)
    participant R2
    participant D1

    Note over Client,D1: CREATE FLOW
    Client->>Router: POST /rpc/runware/createImage
    Router->>Runware: fetch(RUNWARE_API_URL)
    alt API success
        Runware-->>Router: 200 + data
        Router->>DO: stub.init(meta)
        DO->>DO: kv.put("gen"), kv.put("outputs"), setAlarm
        Router-->>Client: { id }
    else API failure
        Runware-->>Router: error
        Router->>DO: stub.init(meta + error)
        DO->>DO: kv.put("gen" with error + completedAt)
        Router-->>Client: throw Error
    end

    Note over Client,D1: WEBHOOK FLOW
    Runware->>Router: POST /webhooks/runware?generation_id=X
    Router->>DO: stub.recordWebhook(payload)
    alt valid data
        DO->>DO: validate, return PendingItem[]
        DO-->>Router: { items, meta }
    else validation/runware error
        DO->>DO: write error output to kv
        DO-->>Router: { items: [], meta }
    end
    Router-->>Runware: 200 (immediate)

    opt items.length > 0
        Router--)BG: waitUntil(processWebhookResults)
        loop each PendingItem
            BG->>Runware: fetch(imageURL)
            Runware-->>BG: image data
            BG->>R2: put(generations/{id})
        end
        BG->>DO: stub.confirmOutputs(results)
        DO->>DO: append outputs, check completion
        DO-->>BG: { complete }
        opt complete
            BG->>DO: stub.getState()
            DO-->>BG: full state
            BG->>D1: insert runwareGenerations
            BG->>D1: insert runwareArtifacts (per success)
        end
    end

    Note over Client,D1: POLL FLOW
    Client->>Router: GET /rpc/runware/getStatus
    Router->>DO: stub.getState()
    DO-->>Router: GenerationState | null
    Router-->>Client: state

    Note over Client,D1: TIMEOUT FLOW
    DO->>DO: alarm() fires after 5min
    DO->>DO: set error=timeout, completedAt
```

## Key Properties

- Runware gets a 200 back before any CDN fetching or R2 storage happens
- The DO is only touched twice during webhook processing: `recordWebhook` (sync KV) and `confirmOutputs` (sync KV)
- All slow I/O (CDN fetch, R2 put, D1 write) lives in the `waitUntil` Worker context
- If `waitUntil` processing crashes, the alarm fires after 5min and marks the generation as timed out
- D1 write only happens once all outputs are confirmed (generation record + artifacts together)
