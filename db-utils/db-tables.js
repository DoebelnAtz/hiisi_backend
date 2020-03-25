const getFields = (...args) => {
	let res = '';
	args.forEach((arg, index) => {
		res = res + arg + (index < args.length - 1 ? ', ' : '');
	});
	return res;
};

class posts {
	constructor() {
		let shorthand = 'b';
		this.tableName = 'blogs';
		this.short = shorthand;
		this.id = `${shorthand}.b_id`;
		this.title = `${shorthand}.title`;
		this.author = `${shorthand}.author`;
		this.content = `${shorthand}.content`;
		this.pubDate = `${shorthand}.published_date`;
		this.edited = `${shorthand}.edited`;
		this.commentThread = `${shorthand}.commentthread`;
		this.votes = `${shorthand}.votes`;
	}
	get table() {
		return `${this.tableName} ${this.short}`;
	}
}

class postVotes {
	constructor() {
		this.voteTable = 'blogvotes';
		this.voteShort = `bv`;
		this.userId = `${this.voteShort}.u_id`;
		this.postId = `${this.voteShort}.b_id`;
		this.vote = `${this.voteShort}.vote`;
	}

	get table() {
		return `${this.voteTable} ${this.voteShort}`;
	}
}

class users {
	constructor() {
		let shorthand = 'u';
		this.tableName = 'users';
		this.short = shorthand;
		this.id = `${shorthand}.u_id`;
		this.username = `${shorthand}.username`;
		this.profilePic = `${shorthand}.profile_pic`;
	}

	get table() {
		return `${this.tableName} ${this.short}`;
	}
}

class resources {
	constructor() {}
	inspect = () => {
		return 'posts p';
	};
}

class projects {
	constructor() {}
	inspect = () => {
		return 'posts p';
	};
}

module.exports = {
	getFields,
	posts: new posts(),
	postVotes: new postVotes(),
	resources,
	projects,
	users: new users(),
};
