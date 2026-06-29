/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('proposals')

    const numericFieldNames = [
      'summit_altitude',
      'base_altitude',
      'piste_km',
      'beginner_pct',
      'intermediate_pct',
      'advanced_pct',
      'lift_count',
    ]

    for (const name of numericFieldNames) {
      const field = collection.fields.getByName(name)
      if (field) {
        field.required = false
      }
    }

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('proposals')

    const numericFieldNames = [
      'summit_altitude',
      'base_altitude',
      'piste_km',
      'beginner_pct',
      'intermediate_pct',
      'advanced_pct',
      'lift_count',
    ]

    for (const name of numericFieldNames) {
      const field = collection.fields.getByName(name)
      if (field) {
        field.required = true
      }
    }

    app.save(collection)
  }
)
