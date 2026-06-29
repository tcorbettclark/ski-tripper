/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('preferences')
    const field = collection.fields.getByName('time_eating')
    if (field) {
      field.name = 'time_huts'
    }
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('preferences')
    const field = collection.fields.getByName('time_huts')
    if (field) {
      field.name = 'time_eating'
    }
    app.save(collection)
  }
)
