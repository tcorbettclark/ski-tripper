/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_804077199')

    // update field
    collection.fields.addAt(
      6,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text2131879744',
        max: 200000,
        min: 0,
        name: 'thinking',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )

    // update field
    collection.fields.addAt(
      7,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text4274335913',
        max: 200000,
        min: 0,
        name: 'content',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_804077199')

    // update field
    collection.fields.addAt(
      6,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text2131879744',
        max: 0,
        min: 0,
        name: 'thinking',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )

    // update field
    collection.fields.addAt(
      7,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text4274335913',
        max: 0,
        min: 0,
        name: 'content',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )

    return app.save(collection)
  }
)
