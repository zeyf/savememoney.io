
var SQL = require('../../DBConnection');
import useBucket from '../../AWS/AWSDetails'


class Post {
    constructor() {
        this.createv2 = this.createv2.bind(this);
        this.delete = this.delete.bind(this);
        this.getUserPosts = this.getUserPosts.bind(this);
        this.savepost = this.savepost.bind(this);
        this.unsavepost = this.unsavepost.bind(this);
        this.upvote = this.upvote.bind(this);
        this.trending=this.trending.bind(this);
    }

    CheckUserExistenceQuery = 'SELECT email, username FROM users WHERE email = ? OR username = ? ;';
    GetUserPostsQuery = 'SELECT * FROM posts WHERE user_name = ? ;';
    InsertNewSourcePostsQuery = 'INSERT IGNORE INTO posts(postid, title, category, image, url, urldomain, tstamp, price) VALUES(?, ?, ?, ?, ?, ?, ?, ?);';
    GetNewPostIDQuery = 'SELECT id from POSTS WHERE user_name = ? AND tstamp = ? ;'
    RemoveSavedPostQuery = 'DELETE FROM savedposts WHERE post_id = ? AND post_user_name = ? AND savetousername = ? ;';
    GetCurrentUpvotesQuery = 'SELECT upvotes FROM posts WHERE id = ? AND user_name = ?'
    GetCurrentDownvotesQuery = 'SELECT downvotes FROM posts WHERE id = ? AND user_name = ?'
    AddPostQuery = 'INSERT INTO posts(title, category, url, urldomain, tstamp, price, user_name, descript, upvotes, downvotes) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
    AddPostImageQuery = 'UPDATE posts SET image = ? WHERE id = ?;'

    createv2 = (request:any, response:any) => {
        const { file: { originalname, buffer }, body: { email, username, title, category, image, url, descript, price, pfp } } = request;
        const fileTypeSplit = originalname.split(/\./gi);
        const fileType = fileTypeSplit[ fileTypeSplit.length - 1 ];
        SQL.query(this.CheckUserExistenceQuery, [
            email, username
        ], async (err:any, results:any) => {
            if (err) response.send({message: 'There has been an error.'})
            if (!err) {
                if (results.length === 0) response.send({message: 'You are not a valid user.'});
                if (results.length === 1) {
                    const CurrentPostCreationTimeStamp = Date.now()
                    SQL.query(this.AddPostQuery, [
                        title, category, url, this.getURLDomain(url), CurrentPostCreationTimeStamp, price, username, descript, 0, 0
                    ], (err, results) => {
                        if ( err ) response.send({ message: 'There has been an error.', err, status: 400 })
                        if ( !err ) SQL.query(this.GetNewPostIDQuery, [
                            username, CurrentPostCreationTimeStamp
                        ], (err, NewPost) => {
                            if ( err ) response.send({ message: 'There has been an error.', err, status: 400 })
                            const Bucket = 'savememoneypostimages'
                            const S3 = useBucket(Bucket);
                            const { id } = NewPost[0];
                            S3.upload({ Bucket, Key: `${username}post${id}.${fileType}`, Body: buffer }, (err, uploaddata) => {
                                if (err) response.send({ message: 'There has been an error', err, status: 400 })
                                if (!err) {
                                    const { Location } = uploaddata;
                                    SQL.query(this.AddPostImageQuery, [
                                        Location, id
                                    ], (err, results) => {
                                        if ( err ) response.send({ message: 'There has been an error.', err, status: 400 })
                                        if ( !err ) response.send({message: 'Post has been created.', status: 210, redirecturl:`/users/${username}/${id}`});
                                    })
                                }
                            })
                        })
                    })
                }
            }
        })
    }

    getURLDomain = (url:string) => {
        const UncleanDomain = url.split(/\//gi)[2];
        const WWWTest = (/www\./g).test(UncleanDomain);
        if (WWWTest) {return UncleanDomain.split(/www\./gi)[1]}
        if (!WWWTest) {return UncleanDomain}
    }

    DeletePostFromPostsQuery = 'DELETE FROM posts WHERE id = ?';
    DeletePostFromSavedPostsQuery = 'DELETE FROM savedposts WHERE post_id = ?'
    DeletePostFromPostVotesQuery = 'DELETE FROM postvotes WHERE post_id = ?'

    delete = (request:any, response:any) => {
        const { body: { email, username, id } } = request;
        SQL.query(this.CheckUserExistenceQuery, [
            email, username
        ], (err, results: any) => {
            if (err) response.send({message: 'There has been an error.' , err: err, status: 400});
            if (!err) {
                if (results.length === 0) response.send({message: 'You are not a valid user!', err:null, status: 400});
                if (results.length === 1) {
                    const DeletePostInformationFromDatabaseQueries = [ this.DeletePostFromPostsQuery, this.DeletePostFromSavedPostsQuery, this.DeletePostFromPostVotesQuery ]
                    DeletePostInformationFromDatabaseQueries.map((query:string, idx:number) => {
                        SQL.query(query, [
                            id
                        ], (err, results) => {
                            if (err) response.send({message: 'There has been an error.', err, status: 400});
                            if(!err) {
                                if (idx === DeletePostInformationFromDatabaseQueries.length - 1) {
                                    response.send({message: 'Success: Status Code 210', err: null, status: 210, redirecturl: `/users/${username}`})
                                }
                            }
                        })
                    })
                }
            }
        })
    }

    getUserPosts = (request:any, response:any) => {
        const { body: { username } } = request
        SQL.query(this.GetUserPostsQuery, [
            username
        ], (err:any, results:any) => {
            if (err) response.send({message: 'There has been an error.'});
            if (!err) response.send(results);
        })
    }

    unsavepost = (request, response) => {
        const { email, post_id, post_user_name, username } = request.body
        SQL.query(this.CheckUserExistenceQuery, [
            email, username
        ], (err, results) => {
            if (err) response.send({ message: 'There has been an error.', err: err })
            if (!err) {
                SQL.query(this.RemoveSavedPostQuery, [
                    post_id, post_user_name, username
                ], (err, results) => {
                    if (err) response.send({ message: 'There has been an error.', err: err, status: 400 })
                    if (!err) response.send({ message: 'The post has been unsaved.', err:null, status: 210 })
                })
            }
        })
    }

    CheckIfPostAlreadySavedQuery = 'SELECT * FROM savedposts WHERE post_id = ? AND savetousername = ?'
    AddSavePostQuery = 'INSERT INTO savedposts(post_id, post_user_name, savetousername) VALUES(?, ?, ?);'
    
    savepost = (request, response) => {
        const { email, post_id, post_user_name, username } = request.body;
        SQL.query( this.CheckIfPostAlreadySavedQuery, [
            post_id, post_user_name
        ], (err, results) => {
            if ( err ) response.send({ message: 'Error: Status Code 400', err, status: 400 })
            if ( !err ) {
                if (results.length === 1) response.send( { message: 'Error: Post already saved', status: 400 } )
                if (results.length === 0) SQL.query(this.CheckUserExistenceQuery, [
                    email, username
                ], (err, results) => {
                    if (err) response.send({ message: 'There has been an error' })
                    if (!err) {
                        SQL.query(this.AddSavePostQuery, [
                            post_id, post_user_name, username
                        ], (err, results) => {
                            if (err) response.send({ message: 'There has been an error.', err, status: 400 })
                            if (!err) response.send({ message: 'The post has been saved.', err: null, status: 210 })
                        })
                    }
                })
            }
        } )

    }

    UpdatePostUpvoteCountQuery = ' UPDATE posts SET upvotes = ? WHERE id = ? AND user_name = ? AND EXISTS (SELECT username from users WHERE username = ?) '
    CheckIfUpvotedByUserQuery = 'SELECT * FROM postvotes WHERE upvotedbyuser = ? AND post_id = ?'
    RemovePostUpvoteQuery = 'DELETE FROM postvotes WHERE upvotedbyuser = ? AND post_id = ?'
    upvote = (request, response) => {
        const { body: { username, email, post_id, post_user_name } } = request;

        SQL.query(this.CheckIfUpvotedByUserQuery, [
            username, post_id
        ], ( err, results ) => {
            if (err) response.send({ message: 'There has been an error.', err, status: 400 })
            if ( !err ) {
                if (results.length === 0) {
                    SQL.query(this.GetCurrentUpvotesQuery, [
                        post_id, post_user_name
                    ], (err, results) => {
                        if (err) response.send({ message: 'There has been an error.', err, status: 400 })
                        if (!err) {
                            if (results.length === 0) response.send({ message: 'This is not a valid post id and username.', status: 400 })
                            const upvotescount = results[0].upvotes;
                            SQL.query(this.UpdatePostUpvoteCountQuery, [
                                upvotescount + 1, post_id, post_user_name, username
                            ], (err, results) => {
                                if (err) response.send({ message: 'There has been an error', err, status: 400 })
                                if (!err) {
                                    SQL.query('INSERT INTO postvotes(post_id, upvotedbyuser) VALUES(?, ?);', [
                                        post_id, username
                                    ], (err, results) => {
                                        if (err) response.send({ message: 'There has been an error.', err, status: 400 })
                                        if ( ! err ) response.send({
                                            message: 'The post has been upvoted.',
                                            status: 210,
                                            upvotes: upvotescount + 1
                                        })
                                    })
                                } 
                            })
                        }
                    })
                } else {
                    SQL.query(this.GetCurrentUpvotesQuery, [
                        post_id, post_user_name
                    ], (err, results) => {
                        if ( err ) response.send({ message: 'There has been an error.', err, status: 400 })
                        if ( !err ) {
                            if (results.length === 0) response.send({ message: 'This is not a valid post id and username.', status: 400 })
                            if ( results.length === 1 ) {
                                const upvotescount = results[0].upvotes;
                                const NewUpvoteCount = upvotescount - 1
                                SQL.query(this.UpdatePostUpvoteCountQuery, [
                                    NewUpvoteCount, post_id, post_user_name, username
                                ], (err, results) => {
                                    if ( err ) response.send({ message: 'There has been an error.', err, status: 400 })
                                    if ( !err ) SQL.query(this.RemovePostUpvoteQuery, [
                                        username, post_id
                                    ], ( err, results ) => {
                                        if ( err ) response.send({ message: 'There has been an error.', err, status: 400 })
                                        if ( !err ) response.send({ message: ' The post has been un-upvoted.', status: 210, upvotes: NewUpvoteCount })
                                    })
                                })
                            }
                        }
                    })
                }
            }
        })
    }

    GetTrendingPostsQuery = 'SELECT * FROM posts ORDER BY upvotes DESC;'

    trending = (request, response) => {
        SQL.query(this.GetTrendingPostsQuery, (err, trendingposts) => {
            if ( err ) response.send({ message: 'There has been an error.', err, status: 400 })
            if ( !err ) response.send( { trendingposts, status: 210 } )
        })
    }
};

export default Post;