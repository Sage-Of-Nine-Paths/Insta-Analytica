async function fetchData() {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }

    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        const data = await response.json();

        if (data.error) {
            alert(data.error);
            return;
        }

        displayProfileInfo(data.profile);
        displayEngagementChart(data.engagement);
        displayRecentPosts(data.posts);

    } catch (err) {
        console.error(err);
        alert('Failed to fetch data');
    }
}

function displayProfileInfo(profile) {
    const profileInfoSection = document.getElementById('profile-info');
    profileInfoSection.innerHTML = `
        <img src="${profile.profilePic}" alt="${profile.name}">
        <div>
            <h2>${profile.name} (@${profile.username})</h2>
            <p><strong>Followers:</strong> ${profile.followers}</p>
            <p><strong>Following:</strong> ${profile.following}</p>
            <p><strong>Posts:</strong> ${profile.posts}</p>
        </div>
    `;
}

function displayEngagementChart(engagement) {
    const ctx = document.getElementById('engagementChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Avg Likes', 'Avg Comments', 'Engagement Rate %'],
            datasets: [{
                label: 'Metrics',
                data: [engagement.avgLikes, engagement.avgComments, engagement.engagementRate],
                backgroundColor: ['#4CAF50', '#2196F3', '#FF9800']
            }]
        },
        options: { responsive: true }
    });
}

function displayRecentPosts(posts) {
    const recentPostsSection = document.getElementById('recent-posts');
    recentPostsSection.innerHTML = posts.map(post => `
        <div class="post">
            <img src="${post.image}" alt="Post image">
            <p><strong>Caption:</strong> ${post.caption || 'N/A'}</p>
            <p><strong>Likes:</strong> ${post.likes}</p>
            <p><strong>Comments:</strong> ${post.comments}</p>
            <p><strong>Hashtags:</strong> ${post.hashtags.join(', ') || 'None'}</p>
        </div>
    `).join('');
}
