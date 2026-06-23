/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // trips.description
    const trips = app.findCollectionByNameOrId('pbc_1630916145')
    trips.fields.addAt(
      2,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text1843675174',
        max: 200000,
        min: 0,
        name: 'description',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: true,
        system: false,
        type: 'text',
      })
    )
    app.save(trips)

    // proposals.description and proposals.linked_resorts_description
    const proposals = app.findCollectionByNameOrId('pbc_3247561751')
    proposals.fields.addAt(
      5,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text1843675174',
        max: 200000,
        min: 0,
        name: 'description',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: true,
        system: false,
        type: 'text',
      })
    )
    proposals.fields.addAt(
      21,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text2664976940',
        max: 200000,
        min: 0,
        name: 'linked_resorts_description',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )
    app.save(proposals)

    // accommodations.description
    const accommodations = app.findCollectionByNameOrId('pbc_3480351616')
    accommodations.fields.addAt(
      5,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text1843675174',
        max: 200000,
        min: 0,
        name: 'description',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )
    app.save(accommodations)

    // discussion.body
    const discussion = app.findCollectionByNameOrId('pbc_1040828831')
    discussion.fields.addAt(
      4,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text3685223346',
        max: 200000,
        min: 0,
        name: 'body',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: true,
        system: false,
        type: 'text',
      })
    )
    app.save(discussion)

    // preferences.notes
    const preferences = app.findCollectionByNameOrId('pbc_432047489')
    preferences.fields.addAt(
      10,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text18589324',
        max: 200000,
        min: 0,
        name: 'notes',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )
    app.save(preferences)
  },
  (app) => {
    // trips.description - revert
    const trips = app.findCollectionByNameOrId('pbc_1630916145')
    trips.fields.addAt(
      2,
      new Field({
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
      })
    )
    app.save(trips)

    // proposals.description and proposals.linked_resorts_description - revert
    const proposals = app.findCollectionByNameOrId('pbc_3247561751')
    proposals.fields.addAt(
      5,
      new Field({
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
      })
    )
    proposals.fields.addAt(
      21,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text2664976940',
        max: 0,
        min: 0,
        name: 'linked_resorts_description',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )
    app.save(proposals)

    // accommodations.description - revert
    const accommodations = app.findCollectionByNameOrId('pbc_3480351616')
    accommodations.fields.addAt(
      5,
      new Field({
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
        required: false,
        system: false,
        type: 'text',
      })
    )
    app.save(accommodations)

    // discussion.body - revert
    const discussion = app.findCollectionByNameOrId('pbc_1040828831')
    discussion.fields.addAt(
      4,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text3685223346',
        max: 0,
        min: 0,
        name: 'body',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: true,
        system: false,
        type: 'text',
      })
    )
    app.save(discussion)

    // preferences.notes - revert
    const preferences = app.findCollectionByNameOrId('pbc_432047489')
    preferences.fields.addAt(
      10,
      new Field({
        autogeneratePattern: '',
        help: '',
        hidden: false,
        id: 'text18589324',
        max: 0,
        min: 0,
        name: 'notes',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      })
    )
    app.save(preferences)
  }
)
