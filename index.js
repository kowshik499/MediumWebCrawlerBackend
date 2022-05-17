const cheerio = require("cheerio");
const express = require("express");
const path = require("path");
const axios = require("axios");
const mysql = require("mysql2/promise");
const {v4: uuidv4} = require("uuid");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");


let db = null;

const initializeDB = async () =>{
    try{
        db = await mysql.createConnection({
            host: "sql6.freesqldatabase.com",
            user: "sql6492389",
            password: "ihsK38JThX",
            database: "sql6492389",
            port: 3306
        })
    }
    catch(error){
        console.log(error)
    }
}

initializeDB()


const app = express();
app.use(express.json())

// app.use(express.static(path.join(__dirname, "public")))

const PORT =  process.env.PORT || 5000

app.listen(PORT, ()=>{
    console.log(`Server listening on port ${PORT}`);
});

const checkBlog = async (blogName) =>{
    
    // console.log("checking blog details by link");

    const selectBlogQuery = `
        SELECT * FROM blogs
        WHERE blog_name = "${blogName}";
    `;
    try{
        const data = await db.query(selectBlogQuery)
        if (data[0].length !==0){
            // console.log("Blog present in DB and returning details")
            return data[0]
        }
        else{
            // console.log("Blog not present in DB and returning false")
            return false
        }
    }
    catch(error){
        console.log(error)
    }
}

const insertBlog = async (blogData) =>{
    // console.log("Inserting blog into blogs table")

    const {id, blogLink, blogName, blogDescription, authorName, authorBlogLink, publishedTime, readTime, relatedTag} = blogData
    const insertBlogQuery = `
    INSERT INTO blogs 
    (   id,
        blog_link,
        blog_name,
        blog_description,
        author_name,
        author_blog_link,
        published_time,
        read_time,
        related_tag
    )
    VALUES
    ?;
    `;
    const values = [[id, blogLink, blogName, blogDescription, authorName, authorBlogLink, publishedTime, readTime, relatedTag]]
    try{
        const response = await db.query(insertBlogQuery, [values])
        // console.log("Blog Inserted into blogs table. Here is the response")
        // console.log(response[0])
    }
    catch(err){
        console.log(err)
    }
}

const pushBlogsData = async (index, articleSelector, $, detailsArr) => {
    // const parentIndex = 4;
    let parentIndex = index + 1;
    const blogLink = $(`${articleSelector}:nth-child(${parentIndex}) > div > div > div > div > div > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > span > a`).attr('href');
    const blogName = $(`${articleSelector}:nth-child(${parentIndex}) > div > div > div > div > div > div:nth-child(2) > div > div:nth-child(1) > div > div > div > div > div:nth-child(1) > div:nth-child(1) > a > div:nth-child(1) > h2`).text()
    // console.log(blogLink)
    if(blogLink !== undefined && blogName!==""){
        
        // console.log("Blog Link not present in database, scraping data from website")
        const authorName = $(`${articleSelector}:nth-child(${parentIndex}) > div > div > div > div > div > div:nth-child(1) > div:nth-child(2) > div.o > div > span > div > a > p`).text();    
        const authorBlogLink = $(`${articleSelector}:nth-child(${parentIndex}) > div > div > div > div > div > div:nth-child(1) > div:nth-child(1) > a`).attr('href');
        const publishedTime = $(`${articleSelector}:nth-child(${parentIndex}) > div > div > div > div > div > div:nth-child(1) > div:nth-child(2) > div.l.fs > span > a > p`).text();
        const readTime = $(`${articleSelector}:nth-child(${parentIndex}) > div > div > div > div > div > div:nth-child(2) > div > div:nth-child(1) > div > div > div > div > div:nth-child(1) > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(2) > a > p`).text()
        const relatedTag = $(`${articleSelector}:nth-child(${parentIndex}) > div > div > div > div > div > div:nth-child(2) > div > div:nth-child(1) > div > div > div > div > div:nth-child(1) > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(1) > a > div`).text();
        const blogDescription = $(`${articleSelector}:nth-child(${parentIndex}) > div > div > div > div > div > div:nth-child(2) > div > div:nth-child(1) > div > div > div > div > div:nth-child(1) > div:nth-child(1) > a > div:nth-child(2) > p`).text();                

        const blogData = {
            id: uuidv4(), 
            blogName, 
            blogLink: `https://medium.com/${blogLink}`, 
            authorName,
            authorBlogLink: `https://medium.com/${authorBlogLink}`,
            publishedTime, readTime, relatedTag, blogDescription
        }
        
        // console.log(blogData)

        detailsArr.push(blogData);
        // console.log("Blog pushed into blogsArr")

        const blogResult = await checkBlog(blogName)

        if (blogResult){
            // console.log("Blog url not empty and returned details")
            console.log("already present in DB")
            // detailsArr.push(blogResult[0])
        }
        else{
            await insertBlog(blogData);
        }
    }
    console.log(detailsArr)
    return detailsArr
}

const getBlogsData = async (tag) => {
    try{
        const blogsurl = `https://medium.com/tag/${tag}`;

        const response = await axios(blogsurl, {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "en-US,en;q=0.9"
        });
        let $ = cheerio.load(response.data);
        const articleSelector = "#root > div > div:nth-child(3) > div > div > main > div > div:nth-child(2) > div.l > article";

        let detailsArr = [];
        $(articleSelector).each(async (index) => {
            detailsArr = await pushBlogsData(index, articleSelector, $, detailsArr)
            // console.log(detailsArr)
        })
        console.log("Stringified blogs data returned to api");
        // console.log(detailsArr);
        return JSON.stringify(detailsArr);
    }
    catch(error){
        console.log(`Error occured`);
    }
}

//  getBlogsData("business")
    // .then(data=>{
    //     console.log(data);
    // })

app.post("/blogs/", async (request, response)=>{
    const {tag} = request.body
    try{
        const allBlogsDetails = await getBlogsData(tag);
        console.log(allBlogsDetails)
        if(allBlogsDetails.length !== 0){
            response.status(200)
            response.send(allBlogsDetails)
        }
        else{
            response.status(500)
            response.send("Enter Correct Tag")
        }
    } 
    catch(error){
        response.status(500)
        response.send(error.message)
    }
});




const insertSpecificBlogData = async (blogDetails) =>{
    
    console.log("Inserting blog Details")

    const {id, blogTitle, blogSubTitle, blogLink, authorName, authorBlogLink, publishedDate, readTime, clapCount, commentCount, blogContent} = blogDetails
    const insertBlogQuery = `
    INSERT INTO specific_blog_details 
    (   id,
        blog_title,
        blog_sub_title,
        blog_link,
        author_name,
        author_blog_link,
        published_date,
        read_time,
        clap_count,
        comment_count,
        blog_content
    )
    VALUES
    ?;
    `;
    const values = [[id, blogTitle, blogSubTitle, blogLink,authorName, authorBlogLink, publishedDate, readTime, clapCount, commentCount, blogContent]]
    try{
        const response = await db.query(insertBlogQuery, [values])
        console.log("Blog Details Inserted into DB. Here is the response")
        console.log(response[0])
    }
    catch(err){
        console.log(err)
    }
}

const checkSpecificBlogData = async(blogLink) =>{
    
    console.log("checking blog details by title");

    const selectBlogQuery = `
        SELECT * FROM specific_blog_details
        WHERE blog_link = "${blogLink}"
    `;
    try{
        const data = await db.query(selectBlogQuery)
        // console.log(data[0])
        if (data[0].length !==0){
            return data[0]
        }
        else{
            console.log("Blog details not present in DB and returning false")
            return false
        }
    }
    catch(error){
        console.log(error)
    }
}


const getSpecificBlogData = async (url) => {
    try{
        const response = await axios(url, {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "en-US,en;q=0.9"
        });
        let $ = cheerio.load(response.data);
        
        //Getting Content of a specific blog
        let blogContent = "";
        const contentSelector = ".pw-post-body-paragraph";

        $(contentSelector).each((index, elm)=>{
            if(elm.name == 'p'){
                const text = $(`${contentSelector}`).text().trim();
                if (text){
                    blogContent = blogContent + " $$$$$$$$$$ " + text;
                }
            }
        })

        //Getting Blog Details
        const blogTitle = $(".pw-post-title").text()
        console.log(blogTitle)
        
        const blogDetailsResult = await checkSpecificBlogData(url)
        
        if (blogDetailsResult){
            console.log("Blog title not empty and returned details")
            console.log(blogDetailsResult[0])
            return JSON.stringify(blogDetailsResult[0])
        }
        else{
            console.log("Blog title not present in database, scraping data from website")

            const blogSubTitle = $(".pw-subtitle-paragraph").text();
            const authorName = $(".pw-author").text();
            const authorBlogLink = $(".pw-author > div > div:nth-child(1) > div > a").attr('href')
            const publishedDate = $(".pw-published-date").text()
            const readTime = $(".pw-reading-time").text()
            // const imageCredit = $("#root > div > div.l.c > div > div > main > div > div.fz.ga.gb.gc.gd.l > div:nth-child(1) > div > article > div > div:nth-child(2) > section > div > div.ja.jb.jc.jd.je > figure > figcaption").text();
            // const imageCreditLink = $("#root > div > div.l.c > div > div > main > div > div.fz.ga.gb.gc.gd.l > div:nth-child(1) > div > article > div > div:nth-child(2) > section > div > div.ja.jb.jc.jd.je > figure > figcaption > a").attr('href');
            const clapCount = $(".pw-multi-vote-count > div > div >p").text()
            const commentCount = $(".pw-responses-count").text()

            const blogDetails = {
                id: uuidv4(), 
                blogTitle, blogSubTitle, 
                blogLink: url,
                authorName, 
                authorBlogLink: `https://medium.com/${authorBlogLink}`,
                publishedDate, readTime, clapCount, commentCount, blogContent
            }
            // console.log(blogDetails)
            
             insertSpecificBlogData(blogDetails)
            console.log("Stringified Blog Details Returned to get api")
            return JSON.stringify(blogDetails)
        }
    }
    catch(error){
        console.error(`Error occured: ${error}`);
    }
}

//  getSpecificBlogData("https://eand.co/the-age-of-cataclysm-ii-d66bc6e2735f?source=topics_v2---------2-84--------------------0f273290_f0bb_4906_b668_bf5d320c0c6a-------19");

app.post("/blog/id", async (request, response)=>{
    const {url} = request.body
    try{
        console.log("Entered into get api request try block")
        const blogDetails = await getSpecificBlogData(url);
        response.status(200)
        response.send(blogDetails)
    }
    catch(error){
        response.status(500)
        response.send(error.message)
    }
})


//SignUp API

app.post("/register/", async (request, response) =>{
    const {username, password, name, gender} = request.body;
    console.log(request.body);
    const getUserQuery = `SELECT * FROM user WHERE username = "${username}" ;`;

    try{
        const userDBDetails = await db.query(getUserQuery);

        if(userDBDetails[0].length !== 0){
            response.status(400);
            response.send("User Already Exists");
        } 
        else{
            if (password.length < 6){
                response.status(400);
                response.send("Password is too short");
            } 
            else{
                const hashedPassword = await bcrypt.hash(password, 10);
                const createUserQuery = `
                INSERT INTO user(username, password, name, gender)
                VALUES ?;
                `;
                const values = [[username, hashedPassword, name, gender]];
                const data = await db.query(createUserQuery, [values]);
                console.log("user details entered into user table");
                console.log(data[0]);
                response.send("User created successfully");
            }
        }
    }
    catch(error){
        console.log(error);
    }
})

//Login API
app.post("/login/", async (request, response) =>{
    const {username, password} = request.body;

    const getUserQuery = `SELECT * FROM user WHERE username= "${username}";`;
    const userDbDetails = await db.query(getUserQuery)
    if (userDbDetails[0].length !== 0){
        const isPasswordCorrect = await bcrypt.compare(password, userDbDetails[0][0].password);
        console.log(isPasswordCorrect)
        
        if (isPasswordCorrect){
            const payload = {username, name: userDbDetails[0].name};
            const jwtToken = jwt.sign(payload, "SECRECT_KEY");
            response.send({jwtToken});
        }
        else{
            response.status(400);
            response.send("Invalid password");
        }
    }
    else{
        response.status(400);
        response.send("Invalid user");
    }
})

app.get("/", (request, response)=>{
    response.send("Working.")
})


app.get("*", (request, response) =>{
    response.send("Invalid Route")
})