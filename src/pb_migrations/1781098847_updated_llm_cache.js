/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_804077199')

    // update collection data
    unmarshal(
      {
        indexes: [
          'CREATE INDEX `idx_llm_cache_input_hash` ON `llm_cache` (`input_hash`)',
        ],
      },
      collection
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_804077199')

    // update collection data
    unmarshal(
      {
        indexes: [],
      },
      collection
    )

    return app.save(collection)
  }
)
