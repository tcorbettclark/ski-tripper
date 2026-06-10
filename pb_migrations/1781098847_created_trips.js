/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = new Collection({
      createRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          autogeneratePattern: '[a-z0-9]{15}',
          help: '',
          hidden: false,
          id: 'text3208210256',
          max: 15,
          min: 15,
          name: 'id',
          pattern: '^[a-z0-9]+$',
          presentable: false,
          primaryKey: true,
          required: true,
          system: true,
          type: 'text',
        },
        {
          autogeneratePattern: '',
          help: '',
          hidden: false,
          id: 'text1997877400',
          max: 0,
          min: 0,
          name: 'code',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          autogeneratePattern: '',
          help: '',
          hidden: false,
          id: 'text1843675174',
          max: 0,
          min: 0,
          name: 'description',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
      ],
      id: 'pbc_1630916145',
      indexes: [],
      listRule: "@request.auth.id != ''",
      name: 'trips',
      system: false,
      type: 'base',
      updateRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_1630916145')

    return app.delete(collection)
  }
)
