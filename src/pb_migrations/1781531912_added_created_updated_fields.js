/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collections = [
      'pbc_1630916145', // trips
      'pbc_653341844', // participants
      'pbc_3247561751', // proposals
      'pbc_3480351616', // accommodations
      'pbc_3598350341', // polls
      'pbc_2597176356', // votes
      'pbc_432047489', // preferences
      'pbc_1040828831', // discussion
      'pbc_804077199', // llm_cache
      'pbc_669819519', // resorts
    ]

    for (const id of collections) {
      const collection = app.findCollectionByNameOrId(id)

      collection.fields.add(
        new AutodateField({
          name: 'created',
          onCreate: true,
          onUpdate: false,
        })
      )

      collection.fields.add(
        new AutodateField({
          name: 'updated',
          onCreate: true,
          onUpdate: true,
        })
      )

      app.save(collection)
    }
  },
  (app) => {
    const collections = [
      'pbc_1630916145', // trips
      'pbc_653341844', // participants
      'pbc_3247561751', // proposals
      'pbc_3480351616', // accommodations
      'pbc_3598350341', // polls
      'pbc_2597176356', // votes
      'pbc_432047489', // preferences
      'pbc_1040828831', // discussion
      'pbc_804077199', // llm_cache
      'pbc_669819519', // resorts
    ]

    for (const id of collections) {
      const collection = app.findCollectionByNameOrId(id)

      collection.fields.removeByName('created')
      collection.fields.removeByName('updated')

      app.save(collection)
    }
  }
)
