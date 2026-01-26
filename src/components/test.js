const assert = require('assert');

const convertToDirectLink = (url) => {
    // Google Drive conversion
    if (url.includes('drive.google.com')) {
        const driveIdMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/);
        if (driveIdMatch && driveIdMatch[1]) {
            return `https://docs.google.com/uc?export=download&id=${driveIdMatch[1]}`;
        }
    }
    // Dropbox conversion
    if (url.includes('dropbox.com')) {
        return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
    }
    return url;
};

// Test cases
const testCases = [
    {
        input: 'https://drive.google.com/file/d/1B_g-8_j3gZ_pZ_0Z_0Z_0Z_0Z_0Z_0/view?usp=sharing',
        expected: 'https://docs.google.com/uc?export=download&id=1B_g-8_j3gZ_pZ_0Z_0Z_0Z_0Z_0Z_0'
    },
    {
        input: 'https://drive.google.com/open?id=1B_g-8_j3gZ_pZ_0Z_0Z_0Z_0Z_0Z_0',
        expected: 'https://docs.google.com/uc?export=download&id=1B_g-8_j3gZ_pZ_0Z_0Z_0Z_0Z_0Z_0'
    },
    {
        input: 'https://drive.google.com/uc?id=1B_g-8_j3gZ_pZ_0Z_0Z_0Z_0Z_0Z_0',
        expected: 'https://docs.google.com/uc?export=download&id=1B_g-8_j3gZ_pZ_0Z_0Z_0Z_0Z_0Z_0'
    },
    {
        input: 'https://www.dropbox.com/s/123456789/test.jpg?dl=0',
        expected: 'https://dl.dropboxusercontent.com/s/123456789/test.jpg'
    },
    {
        input: 'https://www.youtube.com/watch?v=123456789',
        expected: 'https://www.youtube.com/watch?v=123456789'
    }
];

// Run tests
testCases.forEach(testCase => {
    const actual = convertToDirectLink(testCase.input);
    assert.strictEqual(actual, testCase.expected, `Test failed for input: ${testCase.input}`);
});

console.log('All tests passed!');

