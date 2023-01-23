// @ts-check

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('runs', table => {
    table.comment('Codemod runs');
    table
      .uuid('id')
      .primary()
      .notNullable()
      .comment('The ID of the codemod run');
    table
      .text('spec')
      .notNullable()
      .comment('A JSON encoded run specification');
    table
      .integer('targets_count')
      .notNullable()
      .comment('Number of catalog entities targeted by this run');
    table
      .integer('open_count')
      .notNullable()
      .defaultTo(0)
      .comment('Number of open jobs');
    table
      .integer('processing_count')
      .notNullable()
      .defaultTo(0)
      .comment('Number of jobs in processing status');
    table
      .integer('failed_count')
      .notNullable()
      .defaultTo(0)
      .comment('Number of jobs in failed status');
    table
      .integer('cancelled_count')
      .notNullable()
      .defaultTo(0)
      .comment('Number of cancelled jobs');
    table
      .integer('completed_count')
      .notNullable()
      .defaultTo(0)
      .comment('Number of completed jobs');
    table
      .dateTime('created_at')
      .defaultTo(knex.fn.now())
      .notNullable()
      .comment('The timestamp when this run was created');
    table
      .text('created_by')
      .nullable()
      .comment('An entityRef of the user who created the run');
  });

  await knex.schema.createTable('jobs', table => {
    table.comment('Codemod jobs');
    table.uuid('id').primary().notNullable().comment('The ID of the job');
    table.text('status').notNullable().comment('The current status of the job');
    table
      .text('target')
      .notNullable()
      .comment('An entityRef of the entity targeted by the job');
    table
      .uuid('run_id')
      .references('id')
      .inTable('runs')
      .onDelete('CASCADE')
      .notNullable()
      .comment('ID of the codemod run that defined this job');
    table
      .dateTime('last_heartbeat_at')
      .nullable()
      .comment('The last timestamp when a heartbeat was received');
    table.text('output').nullable().comment('Output of the job');
  });

  await knex.schema.createTable('job_events', table => {
    table.comment('The event stream a given job');
    table
      .bigIncrements('id')
      .primary()
      .notNullable()
      .comment('The ID of the event');
    table
      .uuid('job_id')
      .references('id')
      .inTable('jobs')
      .notNullable()
      .onDelete('CASCADE')
      .comment('The job that generated the event');
    table
      .text('body')
      .notNullable()
      .comment('The JSON encoded body of the event');
    table.text('event_type').notNullable().comment('The type of event');
    table
      .timestamp('created_at')
      .defaultTo(knex.fn.now())
      .notNullable()
      .comment('The timestamp when this event was generated');

    table.index(['job_id'], 'job_events_job_id_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  if (!knex.client.config.client.includes('sqlite3')) {
    await knex.schema.alterTable('job_events', table => {
      table.dropIndex([], 'job_events_job_id_idx');
    });
  }
  await knex.schema.dropTable('job_events');
  await knex.schema.dropTable('jobs');
  await knex.schema.dropTable('runs');
};
