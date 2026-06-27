# Search Feature

## Overview
The Search feature provides the ability to query information and retrieve relevant results, including titles and links to the source.

## Data Structures
- **SearchQuery**: Contains the search string `query`.
- **SearchResult**: Represents a single search result containing a `title` and a `link`.
- **SearchResponse**: Contains a list of `SearchResult`s.

## Interface
- **ISearchEngine**: Exposes the `search` method which takes a `SearchQuery` and returns a Promise resolving to a `SearchResponse`.
