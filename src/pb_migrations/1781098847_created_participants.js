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
          cascadeDelete: false,
          collectionId: 'pbc_3142635823',
          help: '',
          hidden: false,
          id: 'relation2375276105',
          maxSelect: 1,
          minSelect: 0,
          name: 'user',
          presentable: false,
          required: true,
          system: false,
          type: 'relation',
        },
        {
          autogeneratePattern: '',
          help: '',
          hidden: false,
          id: 'text1579384326',
          max: 0,
          min: 0,
          name: 'name',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          cascadeDelete: true,
          collectionId: 'pbc_1630916145',
          help: '',
          hidden: false,
          id: 'relation1985410363',
          maxSelect: 1,
          minSelect: 0,
          name: 'trip',
          presentable: false,
          required: true,
          system: false,
          type: 'relation',
        },
        {
          help: '',
          hidden: false,
          id: 'select1466534506',
          maxSelect: 1,
          name: 'role',
          presentable: false,
          required: true,
          system: false,
          type: 'select',
          values: ['coordinator', 'participant'],
        },
      ],
      id: 'pbc_653341844',
      indexes: [],
      listRule: "@request.auth.id != ''",
      name: 'participants',
      system: false,
      type: 'base',
      updateRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_653341844')

    return app.delete(collection)
  }
)
