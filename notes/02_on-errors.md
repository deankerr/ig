# On Errors

## Never Throw Away Data

It's so often the case that when you locate your error in whatever observability view, that critical field is not there, because someone didn't think it would ever be important.

```ts
  catch (err) {
    return { error: err?.message }
    // custom error fields are common
  }
```

We're forced to handle many possibilities through a single funnel. You are rarely gaining anything by transforming blindly.

## The Unknown

We know a basic shape of what errors should look like, but sometimes we need to extract certain values. There may be a JSON structure in there. But exceptions can be thrown from all sorts of places, and we eventually have to make a compromise to do the best we can without turning each module into mainly error handling code.

Often, we don't need to know exactly what we're capturing - it all ends up in logs which are easily filtered. Anything that's really a problem can be dealt with when it arises, not beforehand - this leads to throwing away data.

## Use The Tools We Already Have

zod, oRPC, etc. have error helpers that let use do things like easily filter and discover their internal structures.

## Results and Exceptions

Javascript uses exceptions. Sometimes a `{err, data}` result makes more sense. Establish a helper for doing this, or consider a library that has already done the work.

## Fail Fast

Most exceptions we encounter are unrecoverable. The request is doomed - grab what contextual data we can, and try to bubble up as smoothly as possible, so we don't have to worry about handling multiple layers of ok/error paths.

## Layers & Error Boundaries

Our projects tend to become organised into layers. These can be a good place to package an error with contextual information, relevant to the general domain and libs in use. Then we send it to the top. Isolate from the bottom up.

## The Error Wagon

I think the "custom errors" approach goes overboard easily - `NotFoundError`, `WrongAddressError` - this is over-correcting. A single custom error class is usually sufficient. I like the way the ConvexError does it - a clear place for a message, and data. Some extra standard fields can be helpful. I'm generally not a fan of custom "error codes" - they easily become fairly arbitrary and meaningless - just use a short message.

## The Eternal Struggle

Many of these concepts are in direct conflict with each other. But this is the system we have.
