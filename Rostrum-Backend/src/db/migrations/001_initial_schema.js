const path = require('path');

module.exports = {
  version: '001',
  name: 'initial_schema',
  sourceFile: path.join(__dirname, '..', 'schema.sql'),
  // 001 historically points to the canonical schema used for fresh installs.
  // Keep the checksum already recorded in deployed databases, while separately
  // verifying that intentional schema edits update sourceChecksum.
  checksum: 'd91c79792d80b68c5a4d5dbd993babfbfa75bb228874506a75a6a4d6db716b52',
  sourceChecksum: '186fac2e92e465d1a4d52021cce653781fc5a8e0c4f4f7c3268dafed675239f5',
};
