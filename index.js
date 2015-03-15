/*
 * index.js:  Exports GitHub issues into spreadsheet format
 *
 * (C) 2015, EmpireJS.
 *
 */

var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    async = require('async'),
    exceljs = require('exceljs'),
    GitHubApi = require('github');

var importer = module.exports = function (options, callback) {
  // account username to access GitHub repo
  options.commentor = 'hackygolucky';
  // name of file to export to
  options.file = path.join(__dirname, 'empirejs-cfp.xlsx');
  options.github = new GitHubApi({
    // required
    version: "3.0.0",
    // optional
    timeout: 5000
  });

  options.github.authenticate({
    type: 'basic',
    username: options.commentor,
    password: process.env.GITHUB_PASS
  });

  async.waterfall([
    async.apply(importer.readIssues, options),
    async.apply(importer.createSheet, options)
  ], function (err, res) {
    if (err) { return callback(err); }
  });
};

// ### function readIssues (options, callback)
// Reads all the existing issues on the repo so we
// don't create duplicates
//
importer.readIssues = function (options, callback) {
  var github = options.github,
      repo   = options.repo.split('/');

  console.log('Reading issues | %s', options.repo);

  //
  // Remark: This is super brittle and only works
  // for 200 CFP submissions max.
  //
  async.parallel([
    async.apply(github.issues.repoIssues, {
      user: repo[0],
      repo: repo[1],
      per_page: 100,
      page: 1
    }),
    async.apply(github.issues.repoIssues, {
      user: repo[0],
      repo: repo[1],
      per_page: 100,
      page: 2
    }),
    async.apply(github.issues.repoIssues, {
      user: repo[0],
      repo: repo[1],
      per_page: 100,
      page: 3
    })
  ], function (err, pages) {
    if (err) { return callback(err); }

    var all = pages[0].concat(pages[1]).concat(pages[2])
    all.forEach(function (issue) {
      issue.source = {
        user: repo[0],
        repo: repo[1]
      }
    });

    callback(null, all);
  })
};

importer.createSheet = function (options, issues, callback) {
    console.dir(issues);
    callback()
}
