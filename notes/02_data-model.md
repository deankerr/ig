# Considerations

## Background

- Most text-to-image endpoints support a parameter to generated more than one result from the other input parameters.
- Very few of the other media types do.
- A consumer can also submit multiple requests with same parameters. It's possibly slightly less efficient in some cases.
- Our data model assumes one output artifact per generation. If a consumer wants multiples, they can simply create multiple generations.
- We're currently not enforcing this, but probably should.

## Future Features

- If we wanted to add more inference providers, how would our data model adapt?
  - Following from this, what if we supported arbitrary file upload and serving, like a generation result?
