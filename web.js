const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const session = require('express-session');
const app = express();
const port = 8001;

// MySQL 데이터베이스 연결 설정
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'yonyon'
});

// 세션 설정
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

db.connect((err) => {
  if (err) {
    console.error('DB 연결실패: ', err);
    return;
  }
  console.log('DB 연결완료');
});

// 세션 검사 및 user_id, mbti 저장 미들웨어
app.use((req, res, next) => {
  if (req.session.userId && req.session.mbti) {
    res.locals.userId = req.session.userId;
    res.locals.mbti = req.session.mbti;
  }
  next();
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// 세션 검사 미들웨어
const sessionChecker = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  next();
};

// 기본 경로
app.get('/', sessionChecker, (req, res) => {
  res.status(200).json({ message: '메인 페이지 접근' });
});

///////////////////// login /////////////////////
// 로그인 처리
app.post('/doLogin', (req, res) => {
  const { username, password } = req.body;

  const query = 'SELECT * FROM yonyon_user WHERE id = ? AND pw = ?';
  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('쿼리 오류: ', err);
      return res.status(500).json({ error: '서버 오류가 발생했습니다. 나중에 다시 시도해주세요.' });
    }

    if (results.length > 0) {
      req.session.userId = username;
      req.session.mbti = results[0].mbti; // mbti 세션에 저장
      return res.status(200).json({ message: '로그인 성공', redirect: '/main' });
    } else {
      return res.status(401).json({ error: '아이디 혹은 패스워드가 잘못되었습니다.' });
    }
  });
});
///////////////////// login /////////////////////

///////////////////// signUp /////////////////////
app.post('/doSignUp', (req, res) =>
{
  const { pw, user_name, mbti, email, interest } = req.body;

  // 회원가입 정보 삽입
  const insertQuery = 'INSERT INTO yonyon_user (pw, user_name, mbti, email, interest) VALUES (?, ?, ?, ?, ?)';
  db.query(insertQuery, [pw, user_name, mbti, email, interest], (insertErr, insertResults) => {
    if (insertErr) {
      console.error('회원가입 오류: ', insertErr);
      return res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
    }
    console.log('회원가입 성공');
    return res.status(200).json({ message: '회원가입이 성공적으로 완료되었습니다.', redirect: '/login' });
  });
});
///////////////////// signUp /////////////////////

///////////////////// signUp /////////////////////
app.post('/projectUpload', (req, res) =>
  {
    const { project, project_memo, PROJECT_LINK1, PROJECT_LINK2, PROJECT_LINK3 } = req.body;
  
    // 프로젝트 삽입
    const insertQuery = 'INSERT INTO project (project, project_memo , PROJECT_LINK1, PROJECT_LINK2, PROJECT_LINK3, END_YN, DEL_YN) VALUES (?, ?, ?, ?, ?, "N", "N")';
    db.query(insertQuery, [project, project_memo, PROJECT_LINK1, PROJECT_LINK2, PROJECT_LINK3], (insertErr, insertResults) => {
      if (insertErr) {
        console.error('프로젝트 등록 오류: ', insertErr);
        return res.status(500).json({ error: '프로젝트 등록 중 오류가 발생했습니다.' });
      }
      console.log('프로젝트 등록 성공');
      return res.status(200).json({ message: '프로젝트 등록이 성공적으로 완료되었습니다.', redirect: '/main' });
    });
  });
  ///////////////////// signUp /////////////////////

app.get('/main', sessionChecker, (req, res) => {
  // 여기서 '/data' 엔드포인트 실행
  req.url = '/data';
  app.handle(req, res);
});

// 조회 엔드포인트
app.get('/mainData', sessionChecker, async (req, res) => {
  try {
    const projectsPromise = new Promise((resolve, reject) => {
      const projectQuery = `
        SELECT 
          PROJECT_ID,
          PROJECT,
          PROJECT_MEMO,
          END_YN,
          DEL_YN
        FROM 
          PROJECT
        WHERE
          END_YN = 'N' AND DEL_YN = 'N' AND PROJECT_ID NOT IN (SELECT PROJECT_ID FROM PROJECT_MEMBER WHERE USER_ID = ?)
        ORDER BY 
          RAND()
        LIMIT 10
      `;
      
      db.query(projectQuery, [res.locals.userId], (projectErr, projectResults) => {
        if (projectErr) {
          reject(projectErr);
        } else {
          resolve(projectResults);
        }
      });
    });

    const myProjectsPromise = new Promise((resolve, reject) => {
      const myProjectQuery = `
        SELECT 
          P.PROJECT_ID,
          P.PROJECT,
          P.PROJECT_MEMO
        FROM 
          PROJECT P
        JOIN 
          PROJECT_MEMBER PM ON P.PROJECT_ID = PM.PROJECT_ID
        WHERE 
          PM.USER_ID = ?
      `;
      
      db.query(myProjectQuery, [res.locals.userId], (myProjectErr, myProjectResults) => {
        if (myProjectErr) {
          reject(myProjectErr);
        } else {
          resolve(myProjectResults);
        }
      });
    });

    const sameMbtiUsersPromise = new Promise((resolve, reject) => {
      const mbtiQuery = `
        SELECT 
          USER_ID,
          USER_NAME,
          CONCAT(SUBSTRING(MBTI, 2, 1), SUBSTRING(MBTI, 4, 1)) AS MBTI
        FROM 
          USER_INFO
        WHERE 
          SUBSTRING(MBTI, 2, 1) = ? AND SUBSTRING(MBTI, 4, 1) = ?
      `;
      
      const mbti2Char = res.locals.mbti.charAt(1); // MBTI의 두 번째 문자 가져오기
      const mbti4Char = res.locals.mbti.charAt(3); // MBTI의 네 번째 문자 가져오기
    
      db.query(mbtiQuery, [mbti2Char, mbti4Char], (mbtiErr, mbtiResults) => {
        if (mbtiErr) {
          reject(mbtiErr);
        } else {
          resolve(mbtiResults);
        }
      });
    });

    const [projects, myProjects, sameMbtiUsers] = await Promise.all([projectsPromise, myProjectsPromise, sameMbtiUsersPromise]);

    res.status(200).json({ projects, myProjects, sameMbtiUsers });
  } catch (error) {
    console.error('조회 중 오류 발생: ', error);
    res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }
});


app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});