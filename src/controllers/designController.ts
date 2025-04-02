import { RequestHandler } from 'express';
import { prisma } from '../server'; // Adjust import based on your prisma client instance location

// Placeholder for getting purchased designs
export const getPurchasedDesignsController: RequestHandler = async (req, res) => {
  // TODO: Implement logic to get userId from authenticated request
  const userId = 1; // Placeholder - replace with actual user ID from auth

  try {
    // Fetch orders for the user, including items with image URLs
    const orders = await prisma.order.findMany({
      where: { userId: userId },
      include: {
        items: {
          select: {
            imageUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Optional: order by most recent purchase
      },
    });

    // Extract unique image URLs
    const purchasedDesigns = [
      ...new Set(orders.flatMap(order => order.items.map(item => item.imageUrl))),
    ];

    res.status(200).json({ designs: purchasedDesigns });
  } catch (error) {
    console.error('Error fetching purchased designs:', error);
    res.status(500).json({ error: 'Failed to fetch purchased designs' });
  }
};

// Placeholder for getting recent designs
export const getRecentDesignsController: RequestHandler = async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    // Fetch the most recent distinct image URLs from OrderItems
     const recentOrderItems = await prisma.orderItem.findMany({
       orderBy: {
         // Assuming OrderItem has a relation to Order and Order has createdAt
         // Or if OrderItem itself has a timestamp. Adjust accordingly.
         // This assumes we want items from the most recent orders.
         order: { 
            createdAt: 'desc'
         }
       },
       select: {
         imageUrl: true,
       },
       distinct: ['imageUrl'], // Get distinct image URLs
       skip: skip,
       take: limit,
     });

     // Get the total count of distinct designs using groupBy
     const distinctCountResult = await prisma.orderItem.groupBy({
        by: ['imageUrl'],
        _count: {
            imageUrl: true, // We need to count something, imageUrl is fine
        },
     });
     const totalDistinctDesigns = distinctCountResult.length;


    const designs = recentOrderItems.map(item => item.imageUrl);

    res.status(200).json({ 
        designs: designs,
        pagination: {
            currentPage: page,
            pageSize: limit,
            totalItems: totalDistinctDesigns,
            totalPages: Math.ceil(totalDistinctDesigns / limit),
        }
     });
  } catch (error) {
    console.error('Error fetching recent designs:', error);
    res.status(500).json({ error: 'Failed to fetch recent designs' });
  }
}; 