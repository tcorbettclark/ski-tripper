/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_1630916145')

    // update collection data
    unmarshal(
      {
        indexes: ['CREATE UNIQUE INDEX `idx_trips_code` ON `trips` (`code`)'],
      },
      collection
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_1630916145')

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
