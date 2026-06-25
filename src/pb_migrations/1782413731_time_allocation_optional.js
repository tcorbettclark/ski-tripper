/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const preferences = app.findCollectionByNameOrId('pbc_432047489')

    for (const field of preferences.fields) {
      if (
        field.name === 'time_slopes' ||
        field.name === 'time_eating' ||
        field.name === 'time_apres' ||
        field.name === 'time_hotel'
      ) {
        field.required = false
      }
    }

    app.save(preferences)
  },
  (app) => {
    const preferences = app.findCollectionByNameOrId('pbc_432047489')

    for (const field of preferences.fields) {
      if (
        field.name === 'time_slopes' ||
        field.name === 'time_eating' ||
        field.name === 'time_apres' ||
        field.name === 'time_hotel'
      ) {
        field.required = true
      }
    }

    app.save(preferences)
  }
)
