const {
  user,
  free_board,
  univ_board,
  free_comment,
  univ_comment,
  election_comment,
  free_like,
  univ_like,
  issue,
} = require("../models");
const Sequelize = require("sequelize");
const { or, like } = Sequelize.Op;

// 좋아요 모델 교체
const getLikeModel = (like) => {
  if (like == "free") return free_like;
  if (like == "univ") return univ_like;
};

// 좋아요 추가 또는 삭제
const checkLike = async (like, my_like, post_id, user_id) => {
  like = getLikeModel(like);

  if (my_like == null) {
    await like.create({ post_id, user_id });
    return "liked post";
  } else {
    await like.destroy({ where: { post_id, user_id } });
    return "disliked post";
  }
};

// 좋아요 유무 검증
const findLike = async (like, post_id, user_id) => {
  like = getLikeModel(like);

  if (user_id == undefined) {
    return await like.findAll({ where: { post_id } });
  } else {
    return await like.findOne({
      where: {
        user_id,
        post_id,
      },
    });
  }
};

// 게시글 좋아요 갯수 + 내가 좋아요 했는지 유무 조회
const getLikesFromPosts = async (like, user_id, posts, sort, keyword) => {
  like = getLikeModel(like);

  for (let i = 0; i < posts["rows"].length; i++) {
    let is_like = false;
    if (user_id != null) {
      my_like = await like.findOne({
        where: {
          user_id,
          post_id: posts["rows"][i].post_id,
        },
      });

      if (my_like) {
        is_like = true;
      }
    }

    all_like = await like.findAll({
      where: { post_id: posts["rows"][i].post_id },
    });
    posts["rows"][i].like = {
      is_like,
      all_like: all_like.length,
    };
  }

  // 관련도순 검색시 입력받은 키워드를 기준으로 게시글의 제목, 내용을 split으로 분해하여 갯수를 세어 본다.
  if (sort == "relative") {
    for (let i = 0; i < posts["rows"].length; i++) {
      let rel = 0;
      rel += posts["rows"][i]["title"].split(keyword).length - 1;
      rel += posts["rows"][i]["content"].split(keyword).length - 1;
      posts["rows"][i]["rel"] = rel;
    }
    posts["rows"].sort((a, b) => b.rel - a.rel); // rel의 값 순으로 내림차순 정렬.sort((a, b) => b.rel - a.rel); // rel의 값 순으로 내림차순 정렬
  }

  return posts;
};

// 게시글 전체 조회
const findAllPost = async (
  board,
  pageSize,
  offset,
  category,
  keyword,
  search,
  country_id,
  univ_id
) => {
  const options = {
    subQuery: false,
    raw: true,
    limit: Number(pageSize),
    order: [["createdAt", "DESC"]],
    offset: offset,
    where: {},
    attributes: {
      include: [
        [Sequelize.fn("COUNT", Sequelize.col("comment_id")), "comment_count"],
      ],
    },
    include: [
      {
        model: [],
        attributes: [],
      },
      {
        model: user,
        attributes: ["nickname"],
      },
    ],
    group: ["post_id"],
  };

  // 카테고리별 분류시 DB 조회 조건에 포함
  if (category !== undefined) options.where.category = category;

  if (board == "free") {
    if (country_id !== undefined) options.where.country_id = country_id;
    options.include[0].model = free_comment;
    board = free_board;
  } else if (board == "univ") {
    options.where.univ_id = univ_id;
    options.include[0].model = univ_comment;
    board = univ_board;
  }

  // 검색시 입력받은 키워드를 DB 조회 조건에 포함
  if (search == true) {
    const searchWhereOption = {
      [or]: [
        { title: { [like]: `%${keyword}%` } },
        { content: { [like]: `%${keyword}%` } },
      ],
    };
    options.where = searchWhereOption;
    if (category !== undefined) options.where.category = category;
  }

  const posts = await board.findAndCountAll(options);
  posts["count"] = posts["count"].length; // 게시글의 갯수만 필요하기에, Count 갯수만 포함되도록 처리

  // DB에 문자열로 저장된 이미지 리스트 값을 배열로 전환
  let img_list;
  for (i = 0; i < posts["rows"].length; i++) {
    img_list = posts["rows"][i]["img_list"];
    if (img_list != null) {
      img_list = img_list.split(",");
    } else {
      img_list = [];
    }
    posts["rows"][i].img_list = img_list;
  }

  // 페이지네이션을 위한 페이지 갯수 계산
  posts.countPage = Math.ceil(posts["count"] / pageSize);

  return posts;
};

// 게시글 모델 교체
const getBoardModel = (board) => {
  if (board == "free") return free_board;
  if (board == "univ") return univ_board;
};

// 게시글 단일 조회
const findOnePost = async (board, post_id) => {
  board = getBoardModel(board);

  const result = await board.findOne({
    where: { post_id },
    include: [
      {
        model: user,
      },
    ],
  });

  // DB에 문자열로 저장된 이미지 리스트 값을 배열로 전환
  if (result == null) {
    return;
  } else if (result["img_list"] != null) {
    result["img_list"] = img_list = result["img_list"].split(",");
  } else {
    result["img_list"] = [];
  }

  return result;
};

// 게시글 생성
const createPost = async (board, post) => {
  board = getBoardModel(board);

  // 배열로 받아온 이미지 리스트 값을 문자열로 변환하여 DB에 저장
  if (post["img_list"] != undefined)
    post["img_list"] = post["img_list"].toString();

  const result = await board.create(post);

  // DB에 문자열로 저장된 이미지 리스트 값을 배열로 전환
  if (result["img_list"] != null) {
    result["img_list"] = result["img_list"].split(",");
  } else {
    result["img_list"] = [];
  }

  return result;
};

// 게시글 수정
const updatePost = async (board, post, post_id) => {
  board = getBoardModel(board);

  // 배열로 받아온 이미지 리스트 값을 문자열로 변환하여 DB에 저장
  if (post["img_list"] != undefined)
    post["img_list"] = post["img_list"].toString();

  await board.update(post, {
    where: { post_id },
  });

  const newPost = await board.findOne({ where: { post_id } });

  // DB에 문자열로 저장된 이미지 리스트 값을 배열로 전환
  if (newPost["img_list"] != null) {
    newPost["img_list"] = newPost["img_list"].split(",");
  } else {
    newPost["img_list"] = [];
  }

  return newPost;
};

// 게시글 삭제
const deletePost = async (board, post_id) => {
  let comment, like;

  if (board == "free") {
    board = free_board;
    comment = free_comment;
    like = free_like;

    await issue.destroy({
      where: { post_id },
    });
  } else if (board == "univ") {
    board = univ_board;
    comment = univ_comment;
    like = univ_like;
  }

  await board.destroy({
    where: { post_id },
  });
  await comment.destroy({
    where: { post_id },
  });
  await like.destroy({
    where: { post_id },
  });
};

// 게시글 조회수 증가
const countViewPost = async (board, post_id) => {
  board = getBoardModel(board);

  return await board.increment({ view_count: +1 }, { where: { post_id } });
};

// 댓글 모델 교체
const getCommentModel = (comment) => {
  if (comment == "free") return free_comment;
  if (comment == "univ") return univ_comment;
  if (comment == "election") return election_comment;
};

// 댓글 작성
const createComment = async (comment, user_id, post_id, content) => {
  comment = getCommentModel(comment);

  return await comment.create({ user_id, post_id, content });
};

// 댓글 수정
const updateComment = async (comment, comment_id, content) => {
  comment = getCommentModel(comment);

  await comment.update(
    { content },
    {
      where: { comment_id },
    }
  );
  const newComment = await comment.findOne({ where: { comment_id } });

  return newComment;
};

// 댓글 삭제
const destroyComment = async (comment, comment_id) => {
  comment = getCommentModel(comment);

  return await comment.destroy({
    where: {
      comment_id,
    },
  });
};

// 댓글 전체 조회
const findAllComment = async (comment, post_id) => {
  comment = getCommentModel(comment);

  return await comment.findAll({
    where: {
      post_id,
    },
    include: [
      {
        model: user,
        attributes: ["user_id", "nickname"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
};

// 댓글 단일 조회
const findOneComment = async (comment, comment_id) => {
  comment = getCommentModel(comment);

  return await comment.findOne({
    where: { comment_id },
  });
};

// 대학 게시판 공지글 조회
const findFixedPost = async () => {
  const posts = await univ_board.findAndCountAll({
    subQuery: false,
    raw: true,
    where: { is_fixed: true },
    attributes: {
      include: [
        [Sequelize.fn("COUNT", Sequelize.col("comment_id")), "comment_count"],
      ],
    },
    include: [
      {
        model: univ_comment,
        attributes: [],
      },
    ],
    group: ["post_id"],
  });
  posts["count"] = posts["count"].length;

  // DB에 문자열로 저장된 이미지 리스트 값을 배열로 전환
  let img_list;
  for (i = 0; i < posts["rows"].length; i++) {
    img_list = posts["rows"][i]["img_list"];
    if (img_list != null) {
      img_list = img_list.split(",");
    } else {
      img_list = [];
    }
    posts["rows"][i].img_list = img_list;
  }

  return posts;
};

module.exports = {
  findAllPost,
  getLikesFromPosts,
  findOnePost,
  createPost,
  updatePost,
  deletePost,
  checkLike,
  findLike,
  createComment,
  findAllComment,
  findOneComment,
  updateComment,
  destroyComment,
  countViewPost,
  findFixedPost,
};
