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
  options.file = path.join(__dirname, 'cascadia-cfp.xlsx');
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
    issues = issues.filter(function (issue) {
      issue.lines = issue.body.split(/[\r]?\n/);
      return issue.lines[0][0] === '#';
    }).map(importer.parseIssue);

    issues.forEach(function (issue) {
      console.log('--------------------------------\n\n');
      console.dir(issue.parsed);
      // console.dir(issue.lines);
      console.log('\n\n--------------------------------\n\n');
    });
    callback();

    var workbook = new Excel.Workbook()
      , sheet = workbook.addWorksheet("Talk Reviews");

    worksheet.columns = [
        { header: "Title", key: "title", width: 40 },
        { header: "Name", key: "speaker", width: 30 },
        { header: "Location", key: "location", width: 30 },
        { header: "Email", key: "email", width: 40 },
        { header: "Twitter", key: "twitter", width: 20 },
        { header: "GitHub", key: "github", width: 20 },
        { header: "Url(s)", key: "urls", width: 30 },
        { header: "Summary", key: "summary", width: 60 },
        { header: "Speaker Bio", key: "bio", width: 30}
    ];
    
    // for each issue in issues, insert the issue object properties into 
    // subsequent columns in row[i] 
    row.values = {
        title: title,
        speaker: speaker,
        location: speaker.location,
        email: speaker.email,
        twitter: speaker.twitter,
        github: speaker.github, 
        urls: speaker.urls,
        summary: summary,
        bio: speaker.bio
    };  
} 

var speakerParser = /^\s*[\*-] ([\w\(\)]+)\s*:\s+(.*)$/,
    bioParser = /^##\s?Speaker Bio/i;

importer.parseIssue = function (issue) {
  var parsed = issue.parsed = { speaker: {} };
  var lines = issue.lines.slice();
  var maybeSummary = [];

  //
  // Parses a single speaker line from this header:
  // * "Property    : Value"
  //
  function parseSpeakerInfo(line) {
    if (!line || !line.length) { return; }

    var match;
    if ((match = speakerParser.exec(line))) {
      parsed.speaker[match[1].toLowerCase()] = match[2];
    } else {
      maybeSummary.push(line);
    }
  }

  //
  // 1. Parse the title, then parse out the speaker
  // details
  //
  parsed.title = lines.shift().replace(/^# /, '');
  while (lines.length && lines[0].substr(0, 2) !== '##') {
    parseSpeakerInfo(lines.shift());
  }

  if (maybeSummary.length && process.env.DEBUG) {
    console.log('Maybe summary: %s %s', parsed.title, maybeSummary)
  }

  //
  // 2. Parse out the actual talk summary:
  // - Folks really don't know how to write a summary
  // - Or follow a template
  // - So this is basically a huge hack.
  // - Since this isn't a proper state machine.
  //
  var len = maybeSummary.length;
  if (!len || maybeSummary[len - 1].length < 50) {
    lines.shift();
    parsed.summary = [];
    while (lines.length && !bioParser.test(lines[0])) {
      parsed.summary.push(lines.shift());
    }
  } else {
    parsed.summary = maybeSummary;
  }

  //
  // 3. Parse out the actual speaker bio
  //
  lines.shift();
  parsed.speaker.bio = [];
  while (lines.length && lines[0].substr(0, 2) !== '##') {
    parsed.speaker.bio.push(lines.shift());
  }

  return issue;
};
