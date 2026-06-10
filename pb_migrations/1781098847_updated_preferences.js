/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_432047489')

    // update collection data
    unmarshal(
      {
        indexes: [
          'CREATE UNIQUE INDEX `idx_preferences_user` ON `preferences` (`user`)',
        ],
      },
      collection
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_432047489')

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
