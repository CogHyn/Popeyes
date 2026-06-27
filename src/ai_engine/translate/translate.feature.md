# Translate Feature

## Overview
The Translate feature provides capabilities to translate text from one language to another.

## Data Structures
- **TranslateQuery**: Contains the `text` to be translated, an optional `sourceLanguage`, and the required `targetLanguage`.
- **TranslateResponse**: Contains the `translatedText`.

## Interface
- **ITranslateEngine**: Exposes the `translate` method which takes a `TranslateQuery` and returns a Promise resolving to a `TranslateResponse`.
