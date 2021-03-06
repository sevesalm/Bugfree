const truncateHtml = require('truncate-html');

module.exports = function init(params) {
  const { knex, environment } = params;
  // In test environment migrate in test files
  if (environment !== 'test') {
    knex.migrate.latest()
      .catch(err => console.log(err));
  }

  function getUserByUsername(username) {
    return knex('users').where({ username }).first();
  }

  function getUser(id) {
    return knex('users').select().where({ id }).first();
  }

  function getProject(id) {
    return knex('projects').select().where({ id }).first();
  }

  function getProjects() {
    return knex('projects').select();
  }

  function formatArticle(item, truncate) {
    const newItem = item;
    if (newItem.tags[0] == null) {
      newItem.tags = [];
    }
    if (truncate) {
      newItem.content = truncateHtml(newItem.content, 50, { byWords: true, excludes: ['h3'] });
    }
    return newItem;
  }

  // SELECT title, content, timestamp, first_name, last_name, array_agg(article_tag.tag) AS tags
  // FROM articles
  // LEFT JOIN article_tag ON articles.id = article_tag.article_id
  // JOIN users ON articles.author_id = users.id
  // GROUP BY articles.id,
  //          first_name,
  //          last_name;
  function getArticle(id) {
    return knex('articles')
      .select('title', 'content', 'first_name', 'last_name')
      .select(knex.raw('TO_CHAR(timestamp, \'Month fmDD, YYYY\') as datetime, array_agg(tag) as tags'))
      .leftJoin('article_tag', 'articles.id', 'article_tag.article_id')
      .join('users', 'users.id', 'articles.author_id')
      .groupBy('articles.id', 'first_name', 'last_name')
      .where({ 'articles.id': id })
      .first()
      .then(item => {
        if (item == null) {
          throw new Error('No such article');
        }
        const article = formatArticle(item, false);
        return Promise.resolve(article);
      });
  }

  // SELECT title, content, timestamp, first_name, last_name, array_agg(article_tag.tag) AS tags
  // FROM articles
  // LEFT JOIN article_tag ON articles.id = article_tag.article_id
  // JOIN users ON articles.author_id = users.id
  // GROUP BY articles.id,
  //          first_name,
  //          last_name,
  // ORDER BY timestamp DESC;

  function getArticles(offset, limit) {
    return knex('articles')
      .select('articles.id', 'title', 'content', 'first_name', 'last_name')
      .select(knex.raw('TO_CHAR(timestamp, \'Month fmDD, YYYY\') as datetime, array_agg(tag) as tags'))
      .leftJoin('article_tag', 'articles.id', 'article_tag.article_id')
      .join('users', 'users.id', 'articles.author_id')
      .groupBy('articles.id', 'first_name', 'last_name')
      .orderBy('timestamp', 'desc')
      .offset(offset)
      .limit(limit)
      .then(articles => {
        articles.map(item => {
          const article = formatArticle(item, true);
          return article;
        });
        return Promise.resolve(articles);
      });
  }

  function insertArticle(article) {
    return knex('articles').insert(article).returning('id');
  }

  function createTags(tags) {
    return tags.map(tag => ({ tag }));
  }

  function insertTags(tags) {
    const query = knex('tag').insert(createTags(tags));
    return knex.raw('? ON CONFLICT DO NOTHING', [query]);
  }

  function createArticleTags(id, tags) {
    return tags.map(item =>
      ({
        article_id: parseInt(id, 10),
        tag: item,
      }));
  }

  function insertArticleTag(articleId, tags) {
    return knex('article_tag').insert(createArticleTags(articleId, tags)).returning('article_id');
  }

  function insertArticleWithTags(article, tags) {
    if (tags.length === 0) {
      return insertArticle(article);
    }
    return Promise.all([
      insertArticle(article),
      insertTags(tags),
    ])
      .then(values => {
        const articleId = values[0][0];
        return insertArticleTag(articleId, tags);
      });
  }

  return {
    getUserByUsername,
    getUser,
    getProject,
    getProjects,
    getArticle,
    getArticles,
    insertArticleWithTags,
  };
};
