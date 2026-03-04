// Existing code...

// After line 15, where targetUrl is defined
if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    if (!targetUrl.startsWith('/')) {
        targetUrl = '/' + targetUrl;
    }
    targetUrl = 'https://cwmediabkt99.crwilladmin.com' + targetUrl;
    console.log('URL normalized to:', targetUrl);
}

try {
    const parsedUrl = new URL(targetUrl);
    if (parsedUrl.hostname !== 'cwmediabkt99.crwilladmin.com') {
        throw new Error('Invalid domain');
    }
} catch (error) {
    console.error(error);
    throw { status: 400, message: 'Invalid URL or domain'; }
}

// Continue with existing code...