# Summary Feature

## Overview
The Summary feature allows users to provide a long piece of text and receive a concise summarized version.

## Data Structures
- **SummaryQuery**: Contains the `content` to be summarized.
- **SummaryResponse**: Contains the resulting `summaryText`.

## Interface
- **ISummaryEngine**: Exposes the `summarize` method which takes a `SummaryQuery` and returns a Promise resolving to a `SummaryResponse`.
