export type SeedNote = {
  slug: string;
  pillar: "think" | "build" | "belong";
  date: string;
  author: string;
  title: string;
  excerpt: string;
  body: string[];
  featured: boolean;
  createdAt: string;
};

export const SEED_NOTES: SeedNote[] = [
  {
    slug: "moon-flipbook",
    pillar: "think",
    date: "Term 1 · Week 3",
    author: "Ms. Anamika Sharma · Grade 3",
    title: "Why does the moon keep changing shape?",
    excerpt:
      "Aanya wouldn't let the question go — so Grade 3 built a paper flipbook that watches a whole month go by in ten seconds.",
    body: [
      "It started at the window. We were ten minutes into an EVS lesson about day and night when Aanya stopped looking at her book and started looking at the sky. “Miss, why is the moon a different shape every time?” She wasn't asking to get out of work. She really wanted to know.",
      "I could have just told her. Instead, we made flipbooks. Everyone folded a small stack of paper, and over two afternoons we drew the moon on each page — a sliver, then a little more, then full, then back again. Flick the pages with your thumb and a whole month goes by in about ten seconds.",
      "That's when the real arguing started. If the moon makes its own light, one child asked, why is half of it dark? A torch and a cricket ball later, the class had worked out something close to the truth on their own — that the moon only shows us the part the sun happens to be lighting up.",
      "On Friday, at pickup, I watched Aanya hold her flipbook up for her younger brother and explain a crescent to him, thumb flicking, completely sure of herself. That's the whole lesson, really. We didn't give her the answer. We gave her a way to find it — and now it's hers.",
    ],
    featured: true,
    createdAt: "2026-01-03T00:00:00.000Z",
  },
  {
    slug: "paper-bridges",
    pillar: "build",
    date: "Term 1 · Week 4",
    author: "Mr. Shashikanth Raj Urs · Grade 4",
    title: "Forty paper bridges and one very heavy book",
    excerpt:
      "Which shape folds flat, which one holds the weight? Grade 4 found out the only way that sticks — by building and breaking.",
    body: [
      "The brief was simple and slightly ridiculous: one A4 sheet of paper, span the gap between two desks, and hold up the heaviest book we could find. No tape, no towers, no cheating. Just the paper and your wits.",
      "The first bridges went down fast. A flat sheet laid across the gap won't hold a feather, let alone a dictionary — and the children felt that disappointment in their hands, which is exactly the point. Then someone folded their sheet into tight concertina pleats, and it stood. A small crowd gathered.",
      "By the end we had forty bridges and a clear winner. The lesson wasn't really about paper. It was that shape beats material — that how you fold a thing matters more than what it's made of. They worked that out themselves, by building and breaking, not by being told.",
      "The team whose bridge held the fattest dictionary didn't cheer loudly. They just looked at it, then at each other, with the quiet pride of people who made a thing that worked. We'll take that over a full-marks worksheet any day.",
    ],
    featured: false,
    createdAt: "2026-01-02T00:00:00.000Z",
  },
  {
    slug: "lunch-table",
    pillar: "belong",
    date: "Term 1 · Week 2",
    author: "A Grade 2 teacher",
    title: "The new boy and the lunch table",
    excerpt:
      "Nobody asked her to. She just moved her plate across, and the morning's quiet worry quietly went away.",
    body: [
      "There's a particular kind of worry on a new child's first week, and you can spot it from across the hall. Aarav had it. He'd found his classroom and his peg, but the lunch hall is a different test — all those full tables, and nowhere that's obviously yours.",
      "I was about to step in, the way teachers do, when Diya — seven years old, halfway through her lunch — picked up her plate and slid down the bench to make room. She didn't announce it. She didn't look at me for approval. She just said “you can sit here,” and went back to her food.",
      "You can't put that on a report card. There's no grade for noticing that someone is on their own and quietly fixing it. But it's the thing we most want this school to grow, and you can't teach it with a worksheet — you can only make room for it and hope.",
      "By Friday, Aarav's table was a noisy six. He had a seat, and a couple of people who'd saved it for him. The morning's worry was gone, and not one adult had to make it happen.",
    ],
    featured: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];
