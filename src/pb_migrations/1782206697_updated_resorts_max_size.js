/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_669819519')

    // update field
    collection.fields.addAt(
      1,
      new Field({
        help: '',
        hidden: false,
        id: 'file2359244304',
        maxSelect: 1,
        maxSize: 33554432,
        mimeTypes: null,
        name: 'file',
        presentable: false,
        protected: false,
        required: true,
        system: false,
        thumbs: null,
        type: 'file',
      })
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_669819519')

    // update field
    collection.fields.addAt(
      1,
      new Field({
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
      })
    )

    return app.save(collection)
  }
)
