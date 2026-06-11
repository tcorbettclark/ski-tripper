/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = new Collection({
      createRule: null,
      deleteRule: null,
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
          help: '',
          hidden: false,
          id: 'file2359244304',
          maxSelect: 1,
          maxSize: 0,
          mimeTypes: null,
          name: 'file',
          presentable: false,
          protected: false,
          required: true,
          system: false,
          thumbs: null,
          type: 'file',
        },
      ],
      id: 'pbc_669819519',
      indexes: [],
      listRule: "@request.auth.id != ''",
      name: 'resorts',
      system: false,
      type: 'base',
      updateRule: null,
      viewRule: "@request.auth.id != ''",
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_669819519')

    return app.delete(collection)
  }
)
